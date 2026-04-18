/**
 * socketClient.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralised emit helpers for all clip / call / lesson-timer socket events.
 *
 * WHY: Previously every component embedded raw event names AND payload shapes
 * inline. A single typo or shape change required hunting down every callsite.
 * These helpers are the single source of truth for what each event looks like.
 *
 * USAGE: import the named function you need and pass the socket + args.
 *   import { emitClipPlayPause } from '../video/socketClient';
 *   emitClipPlayPause(socket, { clipId, isPlaying, fromUser, toUser });
 */

import { EVENTS } from '../../../helpers/events';

// ── Clip playback ────────────────────────────────────────────────────────────

/**
 * Emit play/pause for a single clip or both clips (lock mode).
 * @param {object} socket
 * @param {{ clipId:string, both?:boolean, isPlaying:boolean, fromUser:object, toUser:object, sessionId?:string }} opts
 */
export const emitClipPlayPause = (socket, { clipId, both = false, isPlaying, fromUser, toUser, sessionId }) => {
  if (!socket) return;
  socket.emit(EVENTS.ON_VIDEO_PLAY_PAUSE, {
    videoId: clipId,
    both,
    isPlaying,
    userInfo: { from_user: fromUser?._id, to_user: toUser?._id },
    ...(sessionId ? { sessionId } : {}),
  });
};

/**
 * Emit a seek / time-sync for a single clip or both clips (lock mode).
 * @param {object} socket
 * @param {{ clipId:string, both?:boolean, progress:number, fromUser:object, toUser:object, sessionId?:string }} opts
 */
export const emitClipSeek = (socket, { clipId, both = false, progress, fromUser, toUser, sessionId }) => {
  if (!socket) return;
  socket.emit(EVENTS.ON_VIDEO_TIME, {
    videoId: clipId,
    both,
    progress,
    userInfo: { from_user: fromUser?._id, to_user: toUser?._id },
    ...(sessionId ? { sessionId } : {}),
  });
};

/**
 * Emit a zoom / pan change for a clip.
 * @param {object} socket
 * @param {{ clipId:string, zoom:number, pan:{x:number,y:number}, fromUser:object, toUser:object, sessionId?:string }} opts
 */
export const emitClipZoomPan = (socket, { clipId, zoom, pan, fromUser, toUser, sessionId }) => {
  if (!socket) return;
  socket.emit(EVENTS.ON_VIDEO_ZOOM_PAN, {
    videoId: clipId,
    zoom,
    pan,
    userInfo: { from_user: fromUser?._id, to_user: toUser?._id },
    ...(sessionId ? { sessionId } : {}),
  });
};

// ── Video layout / selection ─────────────────────────────────────────────────

/**
 * Emit a video select/swap event (trainer only).
 * @param {object} socket
 * @param {{ type:string, id:string|null, fromUser:object, toUser:object }} opts
 */
export const emitVideoSelect = (socket, { type, id, fromUser, toUser }) => {
  if (!socket) return;
  socket.emit(EVENTS.ON_VIDEO_SELECT, {
    type,
    id,
    userInfo: { from_user: fromUser?._id, to_user: toUser?._id },
  });
};

/**
 * Emit hide a video panel (student / teacher / clips).
 * @param {object} socket
 * @param {{ videoType:string, fromUser:object, toUser:object }} opts
 */
export const emitVideoHide = (socket, { videoType, fromUser, toUser }) => {
  if (!socket) return;
  socket.emit(EVENTS.ON_VIDEO_HIDE, {
    videoType,
    userInfo: { from_user: fromUser?._id, to_user: toUser?._id },
  });
};

/**
 * Emit restore / show a video panel.
 * @param {object} socket
 * @param {{ videoType:string, fromUser:object, toUser:object }} opts
 */
export const emitVideoShow = (socket, { videoType, fromUser, toUser }) => {
  if (!socket) return;
  socket.emit(EVENTS.ON_VIDEO_SHOW, {
    videoType,
    userInfo: { from_user: fromUser?._id, to_user: toUser?._id },
  });
};

// ── Lesson timer ─────────────────────────────────────────────────────────────

/** Request the current lesson state (both sides call this on join). */
export const emitLessonStateRequest = (socket, { sessionId }) => {
  if (!socket) return;
  socket.emit('LESSON_STATE_REQUEST', { sessionId });
};

/** Trainer requests the backend to start the lesson timer. */
export const emitLessonTimerStart = (socket, { sessionId }) => {
  if (!socket) return;
  socket.emit('LESSON_TIMER_START_REQUEST', { sessionId });
};

/** Trainer requests the backend to pause the lesson timer. */
export const emitLessonTimerPause = (socket, { sessionId }) => {
  if (!socket) return;
  socket.emit('LESSON_TIMER_PAUSE_REQUEST', { sessionId });
};

/** Trainer requests the backend to resume a paused lesson timer. */
export const emitLessonTimerResume = (socket, { sessionId }) => {
  if (!socket) return;
  socket.emit('LESSON_TIMER_RESUME_REQUEST', { sessionId });
};
