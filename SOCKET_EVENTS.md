# Netqwix Frontend – Socket Events Reference

All Socket.IO events used by the video calling and clip mode features.
Event name constants live in `helpers/events.ts` under `EVENTS`.
Emit helpers live in `app/components/video/socketClient.js`.

---

## Connection / Session Events

| Event name | Direction | Emitter | Listener | Payload | Purpose |
|---|---|---|---|---|---|
| `JOIN_ROOM` | C→S | portrait-calling/index.jsx | backend | `{ sessionId, userId }` | Join the socket room for a booking session |
| `ON_CALL_JOIN` | C→S & S→C | index.jsx | index.jsx | `{ sessionId, userId, accountType }` | Broadcast that a user joined the call |
| `ON_BOTH_JOIN` | S→C | backend | index.jsx | `{ sessionId }` | Both trainer and trainee are now in the room |
| `PARTICIPANT_STATUS_CHANGED` | S→C | backend | index.jsx | `{ userId, status }` | A participant's connection status changed |
| `PARTICIPANT_STALE` | S→C | backend | index.jsx | `{ userId }` | Participant has not sent a heartbeat recently |
| `HEARTBEAT` | C→S | index.jsx (interval) | backend | — | Keep-alive ping every 5 s |
| `CLIENT_PRECALL_CHECK` | C→S | index.jsx | backend | `{ sessionId, step, result }` | Pre-call media/network check steps |
| `disconnect` | built-in | socket.io | index.jsx | — | Socket disconnected |
| `connect` | built-in | socket.io | index.jsx | — | Socket (re)connected |
| `reconnect` | built-in | socket.io | index.jsx | — | Socket successfully reconnected |
| `connect_error` | built-in | socket.io | index.jsx | — | Connection error |
| `reconnect_error` | built-in | socket.io | index.jsx | — | Reconnection error |
| `reconnect_failed` | built-in | socket.io | index.jsx | — | Reconnection gave up |

---

## WebRTC Signaling Events (`EVENTS.VIDEO_CALL.*`)

Used only when PeerJS is not available or as a fallback signaling path.

| Event name | Constant | Direction | Payload |
|---|---|---|---|
| `offer` | `VIDEO_CALL.ON_OFFER` | C↔C | `{ sdp, fromUser, toUser }` |
| `answer` | `VIDEO_CALL.ON_ANSWER` | C↔C | `{ sdp, fromUser, toUser }` |
| `ice-candidate` | `VIDEO_CALL.ON_ICE_CANDIDATE` | C↔C | `{ candidate, fromUser, toUser }` |
| `STOP_FEED` | `VIDEO_CALL.STOP_FEED` | C→C | `{ fromUser, toUser }` — mute remote video |
| `close` | `VIDEO_CALL.ON_CLOSE` | C→C | `{ fromUser, toUser }` — hang up signal |

All of these are forwarded by the backend without modification.

---

## Call Control Events

| Event name | Constant | Direction | Emitter → Listener | Payload |
|---|---|---|---|---|
| `CALL_END` | `EVENTS.CALL_END` | C→C | action-buttons → index.jsx | `{ fromUser, toUser, sessionId }` |

---

## Clip Mode – Video Playback Events

All emits go through `app/components/video/socketClient.js` helpers.

### `ON_VIDEO_PLAY_PAUSE`

**Direction:** C→S→C (trainer emits, backend forwards, trainee receives)

**Emit helper:** `emitClipPlayPause(socket, { clipId, both, isPlaying, fromUser, toUser })`

**Payload:**
```json
{
  "videoId": "<clipId>",
  "both": false,
  "isPlaying": true,
  "userInfo": { "from_user": "<userId>", "to_user": "<userId>" }
}
```

**`both: true`** — dual/lock mode: play/pause both clips simultaneously. Handled at `ClipModeCall` level.
**`both: false`** — single clip. Handled by `useClipModePlayer` for the clip whose `_id` matches `videoId`.

**Listeners:** `useClipModePlayer` (per clip), `ClipModeCall` (for `both:true` events)

---

### `ON_VIDEO_TIME`

**Direction:** C→S→C (trainer seeks, backend forwards, trainee receives)

**Emit helper:** `emitClipSeek(socket, { clipId, both, progress, fromUser, toUser })`

**Payload:**
```json
{
  "videoId": "<clipId>",
  "both": false,
  "progress": 12.5,
  "userInfo": { "from_user": "<userId>", "to_user": "<userId>" }
}
```

**Listeners:** `useClipModePlayer` (per clip). Trainee only — trainer controls their own `currentTime` directly.

---

### `ON_VIDEO_ZOOM_PAN`

**Direction:** C→S→C

**Emit helper:** `emitClipZoomPan(socket, { clipId, zoom, pan, fromUser, toUser })`

**Payload:**
```json
{
  "videoId": "<clipId>",
  "zoom": 1.5,
  "pan": { "x": 20, "y": -10 },
  "userInfo": { "from_user": "<userId>", "to_user": "<userId>" }
}
```

**Listener:** `VideoContainer` inside `clip-mode.jsx` (drives CSS `transform`).

---

### `ON_VIDEO_SELECT`

**Direction:** C→S→C (trainer selects a clip)

**Emit helper:** `emitVideoSelect(socket, { type, id, fromUser, toUser })`

**Payload:**
```json
{
  "type": "trainer" | "trainee" | "both",
  "id": "<clipId> | null",
  "userInfo": { "from_user": "<userId>", "to_user": "<userId>" }
}
```

**Listener:** `portrait-calling/index.jsx` (`handleVideoSelect`), `clip-mode.jsx`.

---

### `ON_VIDEO_HIDE` / `ON_VIDEO_SHOW`

**Direction:** C→S→C

**Emit helpers:** `emitVideoHide`, `emitVideoShow`

**Payload:**
```json
{
  "videoType": "trainer" | "trainee" | "clips",
  "userInfo": { "from_user": "<userId>", "to_user": "<userId>" }
}
```

**Listener:** `ClipModeCall` inside `clip-mode.jsx`.

---

## Canvas / Drawing Events

| Event name | Constant | Purpose |
|---|---|---|
| `EMIT_DRAWING_CORDS` | `EVENTS.EMIT_DRAWING_CORDS` | Broadcast drawing stroke coords |
| `EMIT_STOP_DRAWING` | `EVENTS.EMIT_STOP_DRAWING` | End of stroke |
| `EMIT_CLEAR_CANVAS` | `EVENTS.EMIT_CLEAR_CANVAS` | Clear canvas (emit side) |
| `ON_CLEAR_CANVAS` | `EVENTS.ON_CLEAR_CANVAS` | Clear canvas (receive side) |
| `EMIT_UNDO` | `EVENTS.EMIT_UNDO` | Undo last stroke |
| `ON_UNDO` | `EVENTS.ON_UNDO` | Receive undo |
| `TOGGLE_DRAWING_MODE` | `EVENTS.TOGGLE_DRAWING_MODE` | Toggle draw/pointer mode |
| `TOGGLE_FULL_SCREEN` | `EVENTS.TOGGLE_FULL_SCREEN` | Toggle fullscreen clip view |
| `TOGGLE_LOCK_MODE` | `EVENTS.TOGGLE_LOCK_MODE` | Toggle dual-clip lock mode |

---

## Lesson Timer Events

All lesson timer socket logic lives in `app/components/video/hooks/useLessonTimer.js`.
Emit helpers in `app/components/video/socketClient.js`.

### Emitted by frontend

| Helper function | Event name | Payload | When |
|---|---|---|---|
| `emitLessonStateRequest` | `LESSON_STATE_REQUEST` | `{ sessionId }` | On mount and every 10 s (re-sync) |
| `emitLessonTimerStart` | `LESSON_TIMER_START_REQUEST` | `{ sessionId }` | Trainer: once both users joined + buffer elapsed |
| `emitLessonTimerPause` | `LESSON_TIMER_PAUSE_REQUEST` | `{ sessionId }` | Trainer pauses the timer |
| `emitLessonTimerResume` | `LESSON_TIMER_RESUME_REQUEST` | `{ sessionId }` | Trainer resumes after pause |

### Received from backend

| Event name | Payload shape | When backend sends |
|---|---|---|
| `LESSON_STATE_SYNC` | `{ sessionId, status, startedAt, duration, remainingSeconds }` | Response to `LESSON_STATE_REQUEST`; also on reconnect |
| `TIMER_STARTED` | `{ sessionId, startedAt, duration, remainingSeconds }` | Backend confirms timer started |
| `LESSON_TIME_PAUSED` | `{ sessionId, remainingSeconds }` | Backend confirms timer paused |
| `LESSON_TIME_RESUMED` | `{ sessionId, startedAt, duration, remainingSeconds }` | Backend confirms timer resumed |
| `LESSON_TIME_ENDED` | `{ sessionId }` | Timer reached zero |
| `LESSON_TIMER_ERROR` | `{ sessionId, message }` | Backend error (unused currently) |

**Timer status values:** `"waiting"` | `"running"` | `"paused"` | `"ended"`

**`startedAt` compensation:** When a participant joins late, `useLessonTimer` subtracts elapsed time (`Date.now() - new Date(startedAt)`) from `remainingSeconds` to stay in sync.

---

## Instant Lesson Events (`EVENTS.INSTANT_LESSON.*`)

| Event name | Constant | Direction | Purpose |
|---|---|---|---|
| `INSTANT_LESSON_REQUEST` | `INSTANT_LESSON.REQUEST` | Trainee→S→Trainer | Trainee requests an instant lesson |
| `INSTANT_LESSON_ACCEPT` | `INSTANT_LESSON.ACCEPT` | Trainer→S→Trainee | Trainer accepts |
| `INSTANT_LESSON_DECLINE` | `INSTANT_LESSON.DECLINE` | Trainer→S→Trainee | Trainer declines |
| `INSTANT_LESSON_EXPIRE` | `INSTANT_LESSON.EXPIRE` | S→both | Request timed out |
| `INSTANT_LESSON_CLIPS_SELECTED` | `INSTANT_LESSON.CLIPS_SELECTED` | Trainer→S→Trainee | Trainer selected clips for the session |
| `INSTANT_LESSON_TRAINEE_CANCELLED` | `INSTANT_LESSON.TRAINEE_CANCELLED` | Trainee→S→Trainer | Trainee cancelled before accept |

Handled in `app/components/instant-lesson/useInstantLessonSocket.js`.

---

## Booking Events (`EVENTS.BOOKING.*`)

| Event name | Constant | Direction | Purpose |
|---|---|---|---|
| `BOOKING_CREATED` | `BOOKING.CREATED` | S→C | A new booking was created (refresh list) |
| `BOOKING_STATUS_UPDATED` | `BOOKING.STATUS_UPDATED` | S→C | Booking status changed (refresh list) |

---

## Adding New Events

1. Add the event name string to `helpers/events.ts` under `EVENTS`.
2. Add an emit helper to `app/components/video/socketClient.js`.
3. Document the payload shape in this file.
4. Consume the helper in your component/hook — **do not** call `socket.emit(rawString, ...)` directly.
