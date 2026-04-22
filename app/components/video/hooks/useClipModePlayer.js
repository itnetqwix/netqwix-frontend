/**
 * useClipModePlayer.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralises all clip playback state and socket sync for a single clip panel.
 *
 * Previously this logic lived directly in VideoContainer (clip-mode.jsx), mixed
 * with zoom/pan, canvas, and layout concerns.  Extracting it here means:
 *   • VideoContainer becomes a thin rendering shell.
 *   • The playback contract is testable and reusable.
 *   • Lock-mode delegation (sharedTogglePlayPause / sharedHandleSeek) stays clean.
 *
 * Socket events owned here:
 *   ON_VIDEO_PLAY_PAUSE  – per-clip or both (handled separately by ClipModeCall)
 *   ON_VIDEO_TIME        – per-clip seek sync
 *
 * Zoom/pan socket events stay in VideoContainer because they are tightly coupled
 * to the DOM transform state that lives there.
 *
 * @param {{
 *   socket: object,
 *   videoRef: React.RefObject,
 *   clip: { _id: string },
 *   accountType: string,
 *   fromUser: object,
 *   toUser: object,
 *   isLock?: boolean,
 *   isVideoLoading?: boolean,
 *   sharedTogglePlayPause?: () => void,
 *   sharedHandleSeek?: (e: Event) => void,
 *   setIsPlaying: (v: boolean) => void,
 * }} params
 *
 * @returns {{ togglePlayPause: () => void, handleSeek: (e: Event) => void }}
 */

import { useEffect, useRef, useCallback } from 'react';
import { AccountType } from '../../../common/constants';
import { EVENTS } from '../../../../helpers/events';
import { safePlayVideoElement } from '../videoPlayback';
import { emitClipPlayPause, emitClipSeek } from '../socketClient';

const MIN_READY =
  typeof HTMLMediaElement !== 'undefined' ? HTMLMediaElement.HAVE_CURRENT_DATA : 2;

export const useClipModePlayer = ({
  socket,
  videoRef,
  clip,
  accountType,
  fromUser,
  toUser,
  sessionId,
  isLock = false,
  isVideoLoading = false,
  sharedTogglePlayPause,
  sharedHandleSeek,
  setIsPlaying,
}) => {
  // Queues for events that arrive before or during video load.
  // IMPORTANT: pendingPlayStateRef is set ANY TIME a play/pause event arrives,
  // not only when the video element is null. This way, if safePlayVideoElement
  // internally fails because the <video> element is replaced mid-load (React key
  // remount), the flush effect can still retry once the new element is ready.
  const pendingPlayStateRef = useRef(null);
  const pendingTimeRef = useRef(null);

  const clipId = clip?._id ?? clip?.id;

  // ── Actions exposed to UI ────────────────────────────────────────────────

  /**
   * Toggle play/pause locally and emit to partner.
   * In lock mode, delegates to the shared dual-video handler.
   */
  const togglePlayPause = useCallback(() => {
    if (isLock && typeof sharedTogglePlayPause === 'function') {
      sharedTogglePlayPause();
      return;
    }

    const video = videoRef?.current;
    if (!video) return;

    if (video.paused) {
      // Emit intent first — trainee can react even if this device's play() is blocked
      emitClipPlayPause(socket, { clipId, isPlaying: true, fromUser, toUser, sessionId });
      safePlayVideoElement(video).then((ok) => setIsPlaying(!!ok));
    } else {
      video.pause();
      setIsPlaying(false);
      emitClipPlayPause(socket, { clipId, isPlaying: false, fromUser, toUser, sessionId });
    }
  }, [isLock, sharedTogglePlayPause, videoRef, socket, clipId, fromUser, toUser, sessionId, setIsPlaying]);

  /**
   * Seek to a position and emit to partner.
   * In lock mode, delegates to the shared dual-video seek handler.
   */
  const handleSeek = useCallback((e) => {
    if (isLock && typeof sharedHandleSeek === 'function') {
      sharedHandleSeek(e);
      return;
    }

    const video = videoRef?.current;
    const progress = parseFloat(e.target.value);
    if (!video || isNaN(progress)) return;

    video.currentTime = progress;
    emitClipSeek(socket, { clipId, progress, fromUser, toUser, sessionId });
  }, [isLock, sharedHandleSeek, videoRef, socket, clipId, fromUser, toUser, sessionId]);

  // ── Socket subscriptions ─────────────────────────────────────────────────

  useEffect(() => {
    if (!socket) return;

    const handlePlayPause = (data) => {
      // Events with both:true are for dual-lock mode — handled by ClipModeCall, not here
      if (data?.both) return;

      const incomingId = data?.videoId != null ? String(data.videoId) : '';
      const myId = clipId != null ? String(clipId) : '';
      if (!incomingId || incomingId !== myId) return;

      const shouldPlay = !!data.isPlaying;

      // CRITICAL: always record the intended play-state BEFORE attempting to
      // apply it. If the video element is missing, not yet ready, or gets
      // replaced mid-load (React key remount), the flush effect will retry
      // automatically once the new element fires canplay/loadeddata.
      if (accountType === AccountType.TRAINEE) {
        pendingPlayStateRef.current = shouldPlay;
      }

      const video = videoRef?.current;
      if (!video) return; // flush effect applies when video mounts/loads

      if (shouldPlay) {
        if (video.paused) {
          safePlayVideoElement(video).then((ok) => {
            setIsPlaying(!!ok);
            // Only clear the pending state on confirmed success. If play failed
            // (ok === false), leave it so the flush effect can retry when the
            // video element becomes ready.
            if (ok) pendingPlayStateRef.current = null;
          });
        } else {
          pendingPlayStateRef.current = null; // already playing — nothing to do
        }
      } else {
        // Pause is always synchronous and reliable
        try { video.pause(); } catch (_) {}
        setIsPlaying(false);
        pendingPlayStateRef.current = null;
      }
    };

    const handleTime = (data) => {
      const myId = clipId != null ? String(clipId) : '';
      const incomingId = data?.videoId != null ? String(data.videoId) : '';
      if (!incomingId || incomingId !== myId) return;
      if (accountType !== AccountType.TRAINEE) return;

      const video = videoRef?.current;

      if (!video || video.readyState < MIN_READY) {
        pendingTimeRef.current = data.progress;
        return;
      }

      try {
        video.currentTime = data.progress;
      } catch (_e) {
        pendingTimeRef.current = data.progress;
        return;
      }
      pendingTimeRef.current = null;
    };

    socket.on(EVENTS.ON_VIDEO_PLAY_PAUSE, handlePlayPause);
    socket.on(EVENTS.ON_VIDEO_TIME, handleTime);

    return () => {
      socket.off(EVENTS.ON_VIDEO_PLAY_PAUSE, handlePlayPause);
      socket.off(EVENTS.ON_VIDEO_TIME, handleTime);
    };
  }, [socket, clipId, videoRef, accountType, setIsPlaying]);

  // ── Flush pending state when video becomes ready ─────────────────────────
  //
  // This effect is the safety net for any pending play/seek state. It runs:
  //   1. When isVideoLoading transitions true → false (video finished loading)
  //   2. When the clip changes (clipId dep) — re-attaches listeners to the new element
  //   3. Directly via canplay/loadeddata on the current video element — catches
  //      races where isVideoLoading was already false when the event arrived but
  //      the element became ready asynchronously after a key-remount.

  useEffect(() => {
    const video = videoRef?.current;
    if (!video || accountType !== AccountType.TRAINEE) return;

    const flushPending = () => {
      // Re-read from ref in case the element was replaced since this closure was created
      const v = videoRef?.current;
      if (!v || v.readyState < MIN_READY) return;

      if (pendingTimeRef.current != null) {
        try { v.currentTime = pendingTimeRef.current; } catch (_e) { return; }
        pendingTimeRef.current = null;
      }

      if (pendingPlayStateRef.current != null) {
        const shouldPlay = pendingPlayStateRef.current;
        if (shouldPlay && v.paused) {
          safePlayVideoElement(v).then((ok) => {
            setIsPlaying(!!ok);
            if (ok) pendingPlayStateRef.current = null;
            // If still failing, leave pending for the next readiness event
          });
        } else if (!shouldPlay && !v.paused) {
          v.pause();
          setIsPlaying(false);
          pendingPlayStateRef.current = null;
        } else {
          // Desired state already matches actual state — clear pending
          pendingPlayStateRef.current = null;
        }
      }
    };

    // Flush immediately if video is already ready (handles case where
    // isVideoLoading was false when the play event arrived and safePlay failed)
    if (!isVideoLoading) flushPending();

    // Also flush when the video element itself reports readiness — this catches
    // the race where the <video> was key-remounted after safePlayVideoElement
    // attached its internal loadeddata listener to the old (now dead) element.
    video.addEventListener('canplay', flushPending);
    video.addEventListener('loadeddata', flushPending);

    return () => {
      video.removeEventListener('canplay', flushPending);
      video.removeEventListener('loadeddata', flushPending);
    };
  }, [videoRef, accountType, isVideoLoading, clipId, setIsPlaying]);

  // ── Reset pending state on clip change ───────────────────────────────────

  useEffect(() => {
    pendingPlayStateRef.current = null;
    pendingTimeRef.current = null;
  }, [clip?._id, clip?.id, clip?.file_name]);

  return { togglePlayPause, handleSeek };
};
