/**
 * useLessonTimer.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Owns ALL backend-driven lesson timer state that was previously scattered
 * across portrait-calling/index.jsx as local state + useEffect + useCallback.
 *
 * What it handles:
 *   • Socket subscriptions: LESSON_STATE_SYNC, TIMER_STARTED, LESSON_TIME_PAUSED,
 *     LESSON_TIME_RESUMED, LESSON_TIME_ENDED, LESSON_TIMER_ERROR
 *   • Client-side 1-second interval to count down from the server-provided value
 *   • Auto-start (trainer only, after both users joined + client buffer elapsed)
 *   • Periodic re-sync every 10 seconds to prevent clock drift
 *
 * Callers get a clean read-only API:
 *   { remainingSeconds, status, authoritativeTimer, requestStart, requestPause, requestResume }
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { AccountType } from '../../../common/constants';
import {
  emitLessonStateRequest,
  emitLessonTimerStart,
  emitLessonTimerPause,
  emitLessonTimerResume,
} from '../socketClient';

/**
 * @param {{ socket, sessionId, bothUsersJoined, timerBufferElapsed, accountType }} params
 * @returns {{
 *   remainingSeconds: number|null,
 *   status: 'waiting'|'running'|'paused'|'ended',
 *   authoritativeTimer: object|null,
 *   requestStart: () => void,
 *   requestPause: () => void,
 *   requestResume: () => void,
 * }}
 */
export const useLessonTimer = ({
  socket,
  sessionId,
  bothUsersJoined,
  timerBufferElapsed,
  accountType,
}) => {
  const intervalRef = useRef(null);
  const autoStartedRef = useRef(false);
  const [authoritativeTimer, setAuthoritativeTimer] = useState(null);
  const [status, setStatus] = useState('waiting');
  const [participantsConnected, setParticipantsConnected] = useState(false);
  // Bumped when a timer error arrives so the auto-start effect re-runs after a backoff.
  const [retryToken, setRetryToken] = useState(0);

  // ── Core countdown logic ─────────────────────────────────────────────────

  const startLessonTimer = useCallback(
    ({ sessionId: sid, startedAt, duration, remainingSeconds }) => {
      if (!sid || !duration) return;

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      const remainingAtStart =
        typeof remainingSeconds === 'number' && remainingSeconds >= 0
          ? Math.floor(remainingSeconds)
          : Math.floor(duration);

      // If startedAt is provided, compensate for the time already elapsed since
      // the backend started the timer (handles late-joining participants).
      const baseRemaining = startedAt
        ? Math.max(0, Math.floor(remainingAtStart - (Date.now() - new Date(startedAt).getTime()) / 1000))
        : remainingAtStart;

      const tickStart = Date.now();

      const tick = () => {
        const elapsed = Math.floor((Date.now() - tickStart) / 1000);
        const current = Math.max(0, baseRemaining - elapsed);
        setAuthoritativeTimer({ sessionId: sid, startedAt, duration, remainingSeconds: current });
        if (current <= 0 && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };

      // Paint immediately then start interval
      setAuthoritativeTimer({ sessionId: sid, startedAt, duration, remainingSeconds: baseRemaining });
      intervalRef.current = setInterval(tick, 1000);
    },
    []
  );

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // ── Exposed actions ──────────────────────────────────────────────────────

  const requestStart = useCallback(() => {
    emitLessonTimerStart(socket, { sessionId });
  }, [socket, sessionId]);

  const requestPause = useCallback(() => {
    emitLessonTimerPause(socket, { sessionId });
  }, [socket, sessionId]);

  const requestResume = useCallback(() => {
    emitLessonTimerResume(socket, { sessionId });
  }, [socket, sessionId]);

  // ── Socket subscriptions ─────────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !sessionId) return;

    const matchSession = (data) =>
      data && String(data.sessionId) === String(sessionId);

    const handleStateSync = (state) => {
      if (!matchSession(state)) return;
      const { status: s, startedAt, duration, remainingSeconds, trainerConnected, traineeConnected } = state;

      setStatus(s || 'waiting');
      setParticipantsConnected(!!trainerConnected && !!traineeConnected);

      if (s === 'running' && startedAt && duration) {
        startLessonTimer({ sessionId, startedAt, duration, remainingSeconds });
      } else if (s === 'paused') {
        stopInterval();
        setAuthoritativeTimer({
          sessionId,
          startedAt: null,
          duration: duration || remainingSeconds || 0,
          remainingSeconds: Math.max(0, Math.floor(remainingSeconds || 0)),
        });
      } else if (s === 'ended') {
        stopInterval();
        setAuthoritativeTimer({
          sessionId,
          startedAt: null,
          duration: duration || 0,
          remainingSeconds: 0,
        });
      }
    };

    const handleStarted = (data) => {
      if (!matchSession(data)) return;
      setStatus('running');
      if (data.startedAt && data.duration) {
        startLessonTimer({
          sessionId,
          startedAt: data.startedAt,
          duration: data.duration,
          remainingSeconds: data.remainingSeconds,
        });
      } else {
        // Incomplete payload — re-request full state
        emitLessonStateRequest(socket, { sessionId });
      }
    };

    const handlePaused = (data) => {
      if (!matchSession(data)) return;
      setStatus('paused');
      stopInterval();
      setAuthoritativeTimer((prev) => ({
        sessionId,
        startedAt: null,
        duration: prev?.duration || data.duration || 0,
        remainingSeconds: Math.max(0, Math.floor(data.remainingSeconds || 0)),
      }));
    };

    const handleResumed = (data) => {
      if (!matchSession(data)) return;
      setStatus('running');
      startLessonTimer({
        sessionId,
        startedAt: data.startedAt,
        duration: data.duration,
        remainingSeconds: data.remainingSeconds,
      });
    };

    const handleEnded = (data) => {
      if (!matchSession(data)) return;
      setStatus('ended');
      stopInterval();
      setAuthoritativeTimer((prev) => ({
        sessionId,
        startedAt: null,
        duration: prev?.duration || 0,
        remainingSeconds: 0,
      }));
    };

    const handleTimerError = (data) => {
      console.warn('[useLessonTimer] LESSON_TIMER_ERROR received — will retry auto-start in 2 s:', data);
      // Reset the one-shot guard so the auto-start effect can fire again,
      // then bump retryToken after a backoff so the effect actually re-runs.
      autoStartedRef.current = false;
      setTimeout(() => setRetryToken((t) => t + 1), 2000);
    };

    // Request current state immediately on mount/reconnect
    emitLessonStateRequest(socket, { sessionId });

    socket.on('LESSON_STATE_SYNC', handleStateSync);
    socket.on('TIMER_STARTED', handleStarted);
    socket.on('LESSON_TIME_PAUSED', handlePaused);
    socket.on('LESSON_TIME_RESUMED', handleResumed);
    socket.on('LESSON_TIME_ENDED', handleEnded);
    socket.on('LESSON_TIMER_ERROR', handleTimerError);

    return () => {
      socket.off('LESSON_STATE_SYNC', handleStateSync);
      socket.off('TIMER_STARTED', handleStarted);
      socket.off('LESSON_TIME_PAUSED', handlePaused);
      socket.off('LESSON_TIME_RESUMED', handleResumed);
      socket.off('LESSON_TIME_ENDED', handleEnded);
      socket.off('LESSON_TIMER_ERROR', handleTimerError);
      stopInterval();
    };
  }, [socket, sessionId, startLessonTimer, stopInterval]);

  // ── Periodic re-sync (prevent clock drift between clients) ───────────────

  useEffect(() => {
    if (!socket || !sessionId) return;
    const syncInterval = setInterval(() => {
      if (socket.connected) emitLessonStateRequest(socket, { sessionId });
    }, 10000);
    return () => clearInterval(syncInterval);
  }, [socket, sessionId]);

  // ── Auto-start (trainer only, once both users joined + buffer elapsed) ───

  // Reset auto-start flag when session changes
  useEffect(() => {
    autoStartedRef.current = false;
  }, [sessionId]);

  useEffect(() => {
    if (accountType !== AccountType.TRAINER) return;
    if (!socket?.connected || !sessionId) return;
    if (!(bothUsersJoined || participantsConnected) || !timerBufferElapsed) return;
    if (status !== 'waiting') return;
    if (authoritativeTimer?.remainingSeconds != null) return;
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    requestStart();
  }, [
    accountType,
    socket,
    sessionId,
    bothUsersJoined,
    participantsConnected,
    timerBufferElapsed,
    status,
    authoritativeTimer?.remainingSeconds,
    requestStart,
    retryToken, // bumped by handleTimerError so this effect re-runs after a backoff
  ]);

  // ── Public API ───────────────────────────────────────────────────────────

  return {
    remainingSeconds: authoritativeTimer?.remainingSeconds ?? null,
    status,
    authoritativeTimer,
    requestStart,
    requestPause,
    requestResume,
  };
};
