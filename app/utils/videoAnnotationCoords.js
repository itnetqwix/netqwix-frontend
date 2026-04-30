/**
 * Align cross-participant annotations with the visible video region for object-fit: cover.
 * Canvas/section pixels alone misalign when layout or aspect ratio differs between trainer and trainee.
 */

function clamp01(n) {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function getObjectFitCoverDisplay(videoEl) {
  if (!videoEl || typeof videoEl.getBoundingClientRect !== "function") return null;
  const rect = videoEl.getBoundingClientRect();
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  if (!vw || !vh || rect.width <= 0 || rect.height <= 0) return null;

  const rw = rect.width;
  const rh = rect.height;
  const scale = Math.max(rw / vw, rh / vh);
  const dispW = vw * scale;
  const dispH = vh * scale;
  const offX = (rw - dispW) / 2;
  const offY = (rh - dispH) / 2;

  return {
    rect,
    vw,
    vh,
    dispW,
    dispH,
    offX,
    offY,
  };
}

/** Client viewport coords → normalized UV inside visible cover patch [0,1]² */
export function clientPointToVideoUV(videoEl, clientX, clientY) {
  const m = getObjectFitCoverDisplay(videoEl);
  if (!m) return null;
  const lx = clientX - m.rect.left - m.offX;
  const ly = clientY - m.rect.top - m.offY;
  return {
    u: lx / m.dispW,
    v: ly / m.dispH,
  };
}

/** UV → annotation canvas internal pixels */
export function videoUVToCanvasPoint(canvasEl, videoEl, u, v) {
  const m = getObjectFitCoverDisplay(videoEl);
  if (!m || !canvasEl) return null;
  const canvasRect = canvasEl.getBoundingClientRect();
  const cw = canvasEl.width;
  const ch = canvasEl.height;
  if (!cw || !ch || canvasRect.width <= 0 || canvasRect.height <= 0) return null;

  const clientX = m.rect.left + m.offX + u * m.dispW;
  const clientY = m.rect.top + m.offY + v * m.dispH;

  const sx = cw / canvasRect.width;
  const sy = ch / canvasRect.height;

  return {
    x: (clientX - canvasRect.left) * sx,
    y: (clientY - canvasRect.top) * sy,
  };
}

export function resolveVideoElForTarget(
  targetUserId,
  fromUser,
  toUser,
  localVideoRef,
  remoteVideoRef
) {
  if (!targetUserId) return null;
  if (fromUser?._id && String(targetUserId) === String(fromUser._id)) {
    return localVideoRef?.current || null;
  }
  if (toUser?._id && String(targetUserId) === String(toUser._id)) {
    return remoteVideoRef?.current || null;
  }
  return null;
}

function rectContains(el, clientX, clientY) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return (
    clientX >= r.left &&
    clientX <= r.right &&
    clientY >= r.top &&
    clientY <= r.bottom
  );
}

/** Choose which feed the stroke belongs to when the pointer is over the live call layout. */
export function pickAnnotationVideoEl(
  clientX,
  clientY,
  fromUser,
  toUser,
  selectedUser,
  localVideoRef,
  remoteVideoRef
) {
  const local = localVideoRef?.current;
  const remote = remoteVideoRef?.current;

  const inLocal = rectContains(local, clientX, clientY);
  const inRemote = rectContains(remote, clientX, clientY);

  if (inLocal && inRemote && selectedUser) {
    const preferred =
      String(selectedUser) === String(fromUser?._id) ? local : remote;
    const other = preferred === local ? remote : local;
    const prefContains = preferred && rectContains(preferred, clientX, clientY);
    return prefContains ? preferred : other;
  }
  if (inLocal) return local;
  if (inRemote) return remote;

  if (selectedUser) {
    if (String(selectedUser) === String(fromUser?._id) && local) return local;
    if (String(selectedUser) === String(toUser?._id) && remote) return remote;
  }
  return local || remote || null;
}

export function videoUserIdForElement(videoEl, fromUser, toUser, localVideoRef, remoteVideoRef) {
  if (!videoEl) return null;
  if (localVideoRef?.current === videoEl) return fromUser?._id ?? null;
  if (remoteVideoRef?.current === videoEl) return toUser?._id ?? null;
  return null;
}

export function clampUV(uv) {
  if (!uv || typeof uv.u !== "number" || typeof uv.v !== "number") return null;
  return { u: clamp01(uv.u), v: clamp01(uv.v) };
}

/** Scale pen / arrow visuals when the receiver overlay differs in size from the trainer canvas. */
export function scaleStrokeTheme(theme, trainerCanvasSize, receiverCanvasEl) {
  if (!receiverCanvasEl) {
    return {
      strokeStyle: theme?.strokeStyle || "#ff0000",
      lineWidth: theme?.lineWidth || 3,
      lineCap: theme?.lineCap || "round",
      arrowHeadPx: theme?.arrowHeadPx ?? 10,
    };
  }
  const tw = trainerCanvasSize?.width || receiverCanvasEl.width;
  const th = trainerCanvasSize?.height || receiverCanvasEl.height;
  const s = Math.min(
    receiverCanvasEl.width / (tw || 1),
    receiverCanvasEl.height / (th || 1)
  );
  return {
    strokeStyle: theme?.strokeStyle || "#ff0000",
    lineWidth: Math.max(1, (theme?.lineWidth || 3) * s),
    lineCap: theme?.lineCap || "round",
    arrowHeadPx: Math.max(6, (theme?.arrowHeadPx || 10) * s),
  };
}
