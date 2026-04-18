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
import { AccountType } from '../../common/constants';
import { EVENTS } from '../../../../helpers/events';
import { safePlayVideoElement } from '../videoPlayback';
import { emitClipPlayPause, emitClipSeek } from '../socketClient';

export const useClipModePlayer = ({
  socket,
  videoRef,
  clip,
  accountType,
  fromUser,
  toUser,
  isLock = false,
  isVideoLoading = false,
  sharedTogglePlayPause,
  sharedHandleSeek,
  setIsPlaying,
}) => {
  // Queues for events that arrive before the trainee's <video> is ready
  const pendingPlayStateRef = useRef(null);
  const pendingTimeRef = useRef(null);

  const clipId = clip?._id;

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
      emitClipPlayPause(socket, { clipId, isPlaying: true, fromUser, toUser });
      safePlayVideoElement(video).then((ok) => setIsPlaying(!!ok));
    } else {
      video.pause();
      setIsPlaying(false);
      emitClipPlayPause(socket, { clipId, isPlaying: false, fromUser, toUser });
    }
  }, [isLock, sharedTogglePlayPause, videoRef, socket, clipId, fromUser, toUser, setIsPlaying]);

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
    emitClipSeek(socket, { clipId, progress, fromUser, toUser });
  }, [isLock, sharedHandleSeek, videoRef, socket, clipId, fromUser, toUser]);

  // ── Socket subscriptions ─────────────────────────────────────────────────

  useEffect(() => {
    if (!socket) return;

    const handlePlayPause = (data) => {
      // Events with both:true are for dual-lock mode — handled by ClipModeCall, not here
      if (data?.both) return;

      const incomingId = data?.videoId != null ? String(data.videoId) : '';
      const myId = clipId != null ? String(clipId) : '';
      if (!incomingId || incomingId !== myId) return;

      const video = videoRef?.current;

      if (!video) {
        // Video element not yet mounted — queue for later
        if (accountType === AccountType.TRAINEE) {
          pendingPlayStateRef.current = data.isPlaying;
        }
        return;
      }

      if (data.isPlaying) {
        if (video.paused) safePlayVideoElement(video).then((ok) => setIsPlaying(!!ok));
      } else {
        if (!video.paused) {
          video.pause();
          setIsPlaying(false);
        }
      }
      pendingPlayStateRef.current = null;
    };

    const handleTime = (data) => {
      const myId = clipId != null ? String(clipId) : '';
      const incomingId = data?.videoId != null ? String(data.videoId) : '';
      if (!incomingId || incomingId !== myId) return;
      if (accountType !== AccountType.TRAINEE) return;

      const video = videoRef?.current;
      const minReady =
        typeof HTMLMediaElement !== 'undefined' ? HTMLMediaElement.HAVE_CURRENT_DATA : 2;

      if (!video || video.readyState < minReady) {
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

  // ── Apply queued events once video becomes ready ─────────────────────────

  useEffect(() => {
    const video = videoRef?.current;
    if (!video || accountType !== AccountType.TRAINEE) return;
    // Only flush the queue once loading is done and the element has data
    if (isVideoLoading) return;

    const minReady =
      typeof HTMLMediaElement !== 'undefined' ? HTMLMediaElement.HAVE_CURRENT_DATA : 2;
    if (video.readyState < minReady) return;

    if (pendingTimeRef.current != null) {
      try {
        video.currentTime = pendingTimeRef.current;
      } catch (_e) {
        // If seek still fails, leave it queued — next readiness change will retry
        return;
      }
      pendingTimeRef.current = null;
    }

    if (pendingPlayStateRef.current != null) {
      const shouldPlay = pendingPlayStateRef.current;
      if (shouldPlay && video.paused) {
        safePlayVideoElement(video).then((ok) => setIsPlaying(!!ok));
      } else if (!shouldPlay && !video.paused) {
        video.pause();
        setIsPlaying(false);
      }
      pendingPlayStateRef.current = null;
    }
  }, [videoRef, accountType, isVideoLoading, setIsPlaying]);

  return { togglePlayPause, handleSeek };
};
