import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { EVENTS } from "../../../helpers/events";
import { AccountType, SHAPES } from "../../common/constants";
import { useAppSelector } from "../../store";
import { authState } from "../auth/auth.slice";
import TimeRemaining from "./time-remaining";
import InstantLessonRecordingBar from "./InstantLessonRecordingBar";
import { UserBox, UserBoxMini } from "./user-box";
import { SocketContext } from "../socket";
import { PenTool } from "react-feather";
import { CanvasMenuBar } from "../video/canvas.menubar";
import {
  pickAnnotationVideoEl,
  clientPointToVideoUV,
  videoUVToCanvasPoint,
  resolveVideoElForTarget,
  clampUV,
  scaleStrokeTheme,
} from "../../utils/videoAnnotationCoords";

/** Sentinel `videoId` for ON_VIDEO_ZOOM_PAN — must not match clip Mongo ids. */
const ONE_ON_ONE_ZOOM_VIDEO_ID = "__nq_one_on_one_live__";

const OneOnOneCall = ({
  sessionId,
  sessionAccountType,
  isInstantLesson = false,
  lessonTimerVariant = "scheduled",
  timeRemaining,
  bothUsersJoined = false,
  bufferSecondsRemaining = null,
  lessonTimerStatus = "waiting",
  onStartTimer,
  onPauseTimer,
  onResumeTimer,
  selectedUser,
  setSelectedUser,
  localVideoRef,
  remoteVideoRef,
  toUser,
  fromUser,
  remoteStream,
  localStream,
  isLocalStreamOff,
  setIsLocalStreamOff,
  isRemoteStreamOff,
  isLandscape,
  setShowScreenshotButton
}) => {
  const socket = useContext(SocketContext);
  const { accountType } = useAppSelector(authState);
  const [zoomPan, setZoomPan] = useState({ scale: 1, translate: { x: 0, y: 0 } });
  const lastTouchRef = useRef(0);
  const dragStartRef = useRef(null);
  // Prefer current auth role first; parent prop can be stale during reconnect transitions.
  const roleForLessonClock = accountType ?? sessionAccountType;
  const normalizeRole = (role) => String(role || "").trim().toLowerCase();
  const effectiveRole =
    normalizeRole(accountType) ||
    normalizeRole(sessionAccountType) ||
    normalizeRole(roleForLessonClock);
  const isTrainerRole = effectiveRole === normalizeRole(AccountType.TRAINER);
  const isTraineeRole = effectiveRole === normalizeRole(AccountType.TRAINEE);
  const annotationCanvasRef = useRef(null);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showAnnotTools, setShowAnnotTools] = useState(false);
  const [selectedShape, setSelectedShape] = useState(SHAPES.FREE_HAND);
  const [isCanvasMenuOpen, setIsCanvasMenuOpen] = useState(false);
  const [isCanvasMenuNoteShow, setIsCanvasMenuNoteShow] = useState(false);
  const [micNote, setMicNote] = useState(false);
  const [clipSelectNote, setClipSelectNote] = useState(false);
  const [countClipNoteOpen, setCountClipNoteOpen] = useState(0);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const drawingPathRef = useRef([]); // Store current drawing path for sync
  const drawingHistoryRef = useRef([]);
  const shapeStartRef = useRef(null);
  const shapeCurrentRef = useRef(null);
  const shapeSnapshotRef = useRef(null);
  const annotationVideoElRef = useRef(null);
  /** Per-stroke metadata: video UV (match stream) vs legacy canvas pixels. */
  const strokeCoordMetaRef = useRef({
    coordSpace: "canvasPx",
    targetUserId: null,
    canvasSize: { width: 0, height: 0 },
  });

  // Mirror basic CanvasMenuBar configuration so trainer gets similar tools
  const [canvasConfigs, setCanvasConfigs] = useState({
    sender: {
      strokeStyle: "#ff0000",
      lineWidth: 3,
      lineCap: "round",
    },
  });

  // Track which videos are hidden (dragged outside viewport)
  const [hiddenVideos, setHiddenVideos] = useState({
    student: false,
    teacher: false
  });

  useEffect(()=>{
    setShowScreenshotButton(false)
  },[])

  const emitZoomPanToPeer = useCallback(
    (zoom, pan) => {
      if (
        !socket ||
        !sessionId ||
        !isTrainerRole ||
        !fromUser?._id ||
        !toUser?._id
      ) {
        return;
      }
      socket.emit(EVENTS.ON_VIDEO_ZOOM_PAN, {
        videoId: ONE_ON_ONE_ZOOM_VIDEO_ID,
        zoom,
        pan,
        userInfo: { from_user: fromUser._id, to_user: toUser._id },
        sessionId,
      });
    },
    [socket, sessionId, isTrainerRole, fromUser?._id, toUser?._id],
  );

  const handleZoomWheel = (e) => {
    if (!isTrainerRole || !sessionId) return;
    e.preventDefault();
    e.stopPropagation();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoomPan((prev) => {
      const newScale = Math.max(1, Math.min(5, prev.scale * zoomFactor));
      emitZoomPanToPeer(newScale, prev.translate);
      return { scale: newScale, translate: prev.translate };
    });
  };

  const handleZoomTouchStart = (e) => {
    if (!isTrainerRole || !sessionId) return;
    if (e.touches.length === 1) {
      const t = e.touches[0];
      dragStartRef.current = { x: t.clientX, y: t.clientY };
      lastTouchRef.current = 0;
    } else if (e.touches.length === 2) {
      const [t1, t2] = Array.from(e.touches);
      lastTouchRef.current = Math.hypot(t2.pageX - t1.pageX, t2.pageY - t1.pageY);
      dragStartRef.current = null;
    }
  };

  const handleZoomTouchMove = (e) => {
    if (!isTrainerRole || !sessionId) return;
    if (e.touches.length === 2) {
      e.preventDefault();
      const [t1, t2] = Array.from(e.touches);
      const dist = Math.hypot(t2.pageX - t1.pageX, t2.pageY - t1.pageY);
      const last = lastTouchRef.current;
      if (last > 0) {
        const scaleChange = dist / last;
        setZoomPan((prev) => {
          const newScale = Math.max(1, Math.min(5, prev.scale * scaleChange));
          emitZoomPanToPeer(newScale, prev.translate);
          return { scale: newScale, translate: prev.translate };
        });
      }
      lastTouchRef.current = dist;
      dragStartRef.current = null;
    } else if (e.touches.length === 1 && dragStartRef.current) {
      e.preventDefault();
      const touch = e.touches[0];
      const ds = dragStartRef.current;
      const deltaX = touch.clientX - ds.x;
      const deltaY = touch.clientY - ds.y;
      setZoomPan((prev) => {
        const newTranslate = {
          x: prev.translate.x + deltaX / prev.scale,
          y: prev.translate.y + deltaY / prev.scale,
        };
        emitZoomPanToPeer(prev.scale, newTranslate);
        return { scale: prev.scale, translate: newTranslate };
      });
      dragStartRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleZoomTouchEnd = () => {
    if (!isTrainerRole) return;
    setTimeout(() => {
      lastTouchRef.current = 0;
    }, 100);
    dragStartRef.current = null;
  };

  useEffect(() => {
    if (!socket || !sessionId) return;
    const handler = (data) => {
      if (!data || data.videoId !== ONE_ON_ONE_ZOOM_VIDEO_ID) return;
      if (String(data.sessionId) !== String(sessionId)) return;
      if (!isTraineeRole) return;
      setZoomPan((prev) => ({
        scale: typeof data.zoom === "number" ? data.zoom : prev.scale,
        translate:
          data.pan &&
          typeof data.pan.x === "number" &&
          typeof data.pan.y === "number"
            ? { x: data.pan.x, y: data.pan.y }
            : prev.translate,
      }));
    };
    socket.on(EVENTS.ON_VIDEO_ZOOM_PAN, handler);
    return () => socket.off(EVENTS.ON_VIDEO_ZOOM_PAN, handler);
  }, [socket, sessionId, isTraineeRole]);

  useEffect(() => {
    if (!isTrainerRole) return;
    const onMove = (e) => {
      if (!dragStartRef.current) return;
      const ds = dragStartRef.current;
      const deltaX = e.clientX - ds.x;
      const deltaY = e.clientY - ds.y;
      setZoomPan((prev) => {
        const newTranslate = {
          x: prev.translate.x + deltaX / prev.scale,
          y: prev.translate.y + deltaY / prev.scale,
        };
        emitZoomPanToPeer(prev.scale, newTranslate);
        return { scale: prev.scale, translate: newTranslate };
      });
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    };
    const onUp = () => {
      dragStartRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isTrainerRole, emitZoomPanToPeer]);

  const handleZoomPanMouseDown = (e) => {
    if (!isTrainerRole || !sessionId || e.button !== 0) return;
    if (isAnnotating) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleHideVideo = (videoType) => {
    setHiddenVideos(prev => ({ ...prev, [videoType]: true }));
  };

  const handleRestoreVideo = (videoType) => {
    setHiddenVideos(prev => ({ ...prev, [videoType]: false }));
  };

  const videoSectionRef = useRef(null);

  // Resize annotation canvas to match the live video area (including after clip-mode exit).
  useEffect(() => {
    const section = videoSectionRef.current;
    if (!section) return;

    const resize = () => {
      const canvas = annotationCanvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;

      // Snapshot existing drawing before changing size, to avoid losing
      // annotations when the layout changes (e.g. orientation, layout shifts).
      let prevDataUrl = null;
      const prevWidth = canvas.width;
      const prevHeight = canvas.height;
      if (prevWidth && prevHeight) {
        try {
          prevDataUrl = canvas.toDataURL();
        } catch (e) {
          console.warn("[OneOnOneCall] Failed to snapshot annotation canvas before resize", e);
        }
      }

      const { offsetWidth, offsetHeight } = parent;
      if (offsetWidth && offsetHeight) {
        canvas.width = offsetWidth;
        canvas.height = offsetHeight;
      }

      if (prevDataUrl) {
        const img = new Image();
        img.onload = () => {
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          try {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          } catch (err) {
            console.warn("[OneOnOneCall] Failed to restore annotation canvas after resize", err);
          }
        };
        img.src = prevDataUrl;
      }
    };

    resize();
    window.addEventListener("resize", resize);
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => resize())
        : null;
    if (ro) ro.observe(section);

    return () => {
      window.removeEventListener("resize", resize);
      if (ro) ro.disconnect();
    };
  }, []);

  const getCanvasPos = (e) => {
    const canvas = annotationCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / (rect.width || canvas.width || 1);
    const scaleY = canvas.height / (rect.height || canvas.height || 1);
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const drawShapeOnCtx = (ctx, shape, start, end, theme = {}) => {
    if (!ctx || !start || !end) return;
    ctx.beginPath();
    ctx.strokeStyle = theme.strokeStyle || "#ff0000";
    ctx.lineWidth = theme.lineWidth || 3;
    ctx.lineCap = theme.lineCap || "round";

    const dx = end.x - start.x;
    const dy = end.y - start.y;

    switch (shape) {
      case SHAPES.LINE:
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        break;
      case SHAPES.RECTANGLE:
      case SHAPES.SQUARE:
        ctx.rect(start.x, start.y, dx, dy);
        break;
      case SHAPES.CIRCLE: {
        const radius = Math.sqrt(dx * dx + dy * dy);
        ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
        break;
      }
      case SHAPES.ARROW_RIGHT: {
        const angle = Math.atan2(dy, dx);
        const head =
          theme.arrowHeadPx != null && theme.arrowHeadPx > 0 ? theme.arrowHeadPx : 10;
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.lineTo(
          end.x - head * Math.cos(angle - Math.PI / 6),
          end.y - head * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(
          end.x - head * Math.cos(angle + Math.PI / 6),
          end.y - head * Math.sin(angle + Math.PI / 6)
        );
        break;
      }
      default:
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        break;
    }
    ctx.stroke();
  };

  const getTrainerStrokeTheme = () => {
    const canvas = annotationCanvasRef.current;
    const base = canvasConfigs?.sender || {};
    const cw = canvas?.width || 400;
    return {
      strokeStyle: base.strokeStyle || "#ff0000",
      lineWidth: base.lineWidth || 3,
      lineCap: base.lineCap || "round",
      arrowHeadPx: Math.max(8, cw * 0.014),
    };
  };

  const handlePointerDown = (e) => {
    if (!isTrainerRole || !isAnnotating) return;
    e.preventDefault();
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const videoEl = pickAnnotationVideoEl(
      clientX,
      clientY,
      fromUser,
      toUser,
      selectedUser,
      localVideoRef,
      remoteVideoRef
    );
    annotationVideoElRef.current = videoEl;

    const useVideoUv = !!(
      videoEl &&
      videoEl.videoWidth > 0 &&
      videoEl.videoHeight > 0
    );
    const targetUserId = useVideoUv
      ? videoEl === localVideoRef?.current
        ? fromUser?._id
        : toUser?._id
      : null;

    strokeCoordMetaRef.current = {
      coordSpace: useVideoUv ? "videoUv" : "canvasPx",
      targetUserId,
      canvasSize: { width: canvas.width, height: canvas.height },
    };

    const theme = getTrainerStrokeTheme();
    ctx.strokeStyle = theme.strokeStyle;
    ctx.lineWidth = theme.lineWidth;
    ctx.lineCap = theme.lineCap || "round";

    if (selectedShape === SHAPES.FREE_HAND || !selectedShape) {
      if (useVideoUv) {
        const raw = clientPointToVideoUV(videoEl, clientX, clientY);
        const uv = raw ? clampUV(raw) : { u: 0, v: 0 };
        drawingPathRef.current = [{ u: uv.u, v: uv.v }];
        const pt = videoUVToCanvasPoint(canvas, videoEl, uv.u, uv.v);
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        lastPosRef.current = pt;
      } else {
        const { x, y } = getCanvasPos(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
        lastPosRef.current = { x, y };
        drawingPathRef.current = [{ x, y }];
      }
    } else if (useVideoUv) {
      const raw = clientPointToVideoUV(videoEl, clientX, clientY);
      const uv = raw ? clampUV(raw) : { u: 0, v: 0 };
      shapeStartRef.current = { u: uv.u, v: uv.v };
      shapeCurrentRef.current = { u: uv.u, v: uv.v };
      shapeSnapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } else {
      const { x, y } = getCanvasPos(e);
      shapeStartRef.current = { x, y };
      shapeCurrentRef.current = { x, y };
      shapeSnapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
    setIsDrawing(true);
  };

  const handlePointerMove = (e) => {
    if (!isDrawing || !isTrainerRole || !isAnnotating) return;
    e.preventDefault();
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const videoEl = annotationVideoElRef.current;
    const meta = strokeCoordMetaRef.current;
    const theme = getTrainerStrokeTheme();

    if (selectedShape === SHAPES.FREE_HAND || !selectedShape) {
      if (meta.coordSpace === "videoUv" && videoEl?.videoWidth) {
        const raw = clientPointToVideoUV(videoEl, clientX, clientY);
        const prev = drawingPathRef.current[drawingPathRef.current.length - 1];
        const uv = raw
          ? clampUV(raw)
          : prev && typeof prev.u === "number"
            ? prev
            : clampUV({ u: 0, v: 0 });
        drawingPathRef.current.push({ u: uv.u, v: uv.v });
        const pt = videoUVToCanvasPoint(canvas, videoEl, uv.u, uv.v);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        lastPosRef.current = pt;
      } else {
        const { x, y } = getCanvasPos(e);
        ctx.lineTo(x, y);
        ctx.stroke();
        lastPosRef.current = { x, y };
        drawingPathRef.current.push({ x, y });
      }
    } else if (shapeStartRef.current) {
      if (meta.coordSpace === "videoUv" && videoEl?.videoWidth) {
        const raw = clientPointToVideoUV(videoEl, clientX, clientY);
        const uv = raw ? clampUV(raw) : shapeStartRef.current;
        shapeCurrentRef.current = { u: uv.u, v: uv.v };
        if (shapeSnapshotRef.current) {
          ctx.putImageData(shapeSnapshotRef.current, 0, 0);
        }
        const startPt = videoUVToCanvasPoint(
          canvas,
          videoEl,
          shapeStartRef.current.u,
          shapeStartRef.current.v
        );
        const endPt = videoUVToCanvasPoint(canvas, videoEl, uv.u, uv.v);
        if (startPt && endPt) {
          drawShapeOnCtx(ctx, selectedShape, startPt, endPt, theme);
        }
      } else {
        const { x, y } = getCanvasPos(e);
        shapeCurrentRef.current = { x, y };
        if (shapeSnapshotRef.current) {
          ctx.putImageData(shapeSnapshotRef.current, 0, 0);
        }
        drawShapeOnCtx(ctx, selectedShape, shapeStartRef.current, shapeCurrentRef.current, theme);
      }
    }
  };

  const handlePointerUp = (e) => {
    if (!isDrawing) return;
    e && e.preventDefault();

    const meta = strokeCoordMetaRef.current;

    if (isTrainerRole && socket && fromUser?._id && toUser?._id) {
      const canvas = annotationCanvasRef.current;
      if (canvas) {
        const theme = getTrainerStrokeTheme();
        if (
          (selectedShape === SHAPES.FREE_HAND || !selectedShape) &&
          drawingPathRef.current.length > 0
        ) {
          let strikesPayload;
          let historyEntry;
          if (meta.coordSpace === "videoUv") {
            strikesPayload = JSON.stringify({
              kind: "freehand",
              coordSpace: "videoUv",
              targetUserId: meta.targetUserId,
              points: [...drawingPathRef.current],
            });
            historyEntry = {
              kind: "freehand",
              coordSpace: "videoUv",
              targetUserId: meta.targetUserId,
              points: [...drawingPathRef.current],
              theme,
            };
          } else {
            strikesPayload = JSON.stringify(drawingPathRef.current);
            historyEntry = {
              kind: "freehand",
              coordSpace: "canvasPx",
              canvasSize: { ...meta.canvasSize },
              points: [...drawingPathRef.current],
              theme,
            };
          }
          drawingHistoryRef.current.push(historyEntry);
          socket.emit(EVENTS.DRAW, {
            userInfo: { from_user: fromUser._id, to_user: toUser._id },
            strikes: strikesPayload,
            theme,
            canvasSize: { width: canvas.width, height: canvas.height },
            canvasIndex: 1,
          });
        } else if (shapeStartRef.current && shapeCurrentRef.current) {
          let shapePayload;
          let historyEntry;
          if (meta.coordSpace === "videoUv") {
            shapePayload = {
              kind: "shape",
              coordSpace: "videoUv",
              targetUserId: meta.targetUserId,
              shape: selectedShape,
              start: shapeStartRef.current,
              end: shapeCurrentRef.current,
            };
            historyEntry = {
              kind: "shape",
              coordSpace: "videoUv",
              targetUserId: meta.targetUserId,
              shape: selectedShape,
              start: shapeStartRef.current,
              end: shapeCurrentRef.current,
              theme,
            };
          } else {
            shapePayload = {
              kind: "shape",
              coordSpace: "canvasPx",
              shape: selectedShape,
              start: shapeStartRef.current,
              end: shapeCurrentRef.current,
            };
            historyEntry = {
              ...shapePayload,
              theme,
              canvasSize: { ...meta.canvasSize },
            };
          }
          drawingHistoryRef.current.push(historyEntry);
          socket.emit(EVENTS.DRAW, {
            userInfo: { from_user: fromUser._id, to_user: toUser._id },
            strikes: JSON.stringify(shapePayload),
            theme,
            canvasSize: { width: canvas.width, height: canvas.height },
            canvasIndex: 1,
          });
        }
      }
    }

    drawingPathRef.current = [];
    shapeStartRef.current = null;
    shapeCurrentRef.current = null;
    shapeSnapshotRef.current = null;
    annotationVideoElRef.current = null;
    setIsDrawing(false);
  };

  const clearAnnotations = () => {
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingHistoryRef.current = [];
    
    // Emit clear event to student
    if (isTrainerRole && socket && fromUser?._id && toUser?._id) {
      socket.emit(EVENTS.EMIT_CLEAR_CANVAS, {
        userInfo: { from_user: fromUser._id, to_user: toUser._id },
        canvasIndex: 1,
      });
    }
  };

  const cycleLineWidth = () => {
    const widths = [2, 3, 5, 8];
    const current = canvasConfigs?.sender?.lineWidth || 3;
    const idx = widths.indexOf(current);
    const next = widths[(idx + 1) % widths.length];
    setCanvasConfigs((prev) => ({
      ...prev,
      sender: {
        ...prev.sender,
        lineWidth: next,
      },
    }));
  };

  const redrawLocalHistory = () => {
    const canvas = annotationCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingHistoryRef.current.forEach((stroke) => {
      const theme = stroke?.theme || {};
      const shapeTheme = {
        ...theme,
        arrowHeadPx:
          theme.arrowHeadPx != null ? theme.arrowHeadPx : Math.max(8, canvas.width * 0.014),
      };

      if (stroke?.kind === "shape") {
        if (stroke.coordSpace === "videoUv" && stroke.targetUserId) {
          const videoEl = resolveVideoElForTarget(
            stroke.targetUserId,
            fromUser,
            toUser,
            localVideoRef,
            remoteVideoRef
          );
          if (!videoEl?.videoWidth) return;
          const s = videoUVToCanvasPoint(canvas, videoEl, stroke.start.u, stroke.start.v);
          const en = videoUVToCanvasPoint(canvas, videoEl, stroke.end.u, stroke.end.v);
          if (s && en) drawShapeOnCtx(ctx, stroke.shape, s, en, shapeTheme);
        } else if (stroke.start && stroke.end) {
          const cw = stroke.canvasSize?.width || canvas.width;
          const ch = stroke.canvasSize?.height || canvas.height;
          const sx = canvas.width / (cw || 1);
          const sy = canvas.height / (ch || 1);
          drawShapeOnCtx(
            ctx,
            stroke.shape,
            { x: stroke.start.x * sx, y: stroke.start.y * sy },
            { x: stroke.end.x * sx, y: stroke.end.y * sy },
            shapeTheme
          );
        }
        return;
      }

      const pts = stroke.points || stroke.path || [];
      if (!Array.isArray(pts) || pts.length === 0) return;

      if (
        stroke.coordSpace === "videoUv" ||
        (pts[0] && typeof pts[0].u === "number" && typeof pts[0].v === "number")
      ) {
        const videoEl = resolveVideoElForTarget(
          stroke.targetUserId,
          fromUser,
          toUser,
          localVideoRef,
          remoteVideoRef
        );
        if (!videoEl?.videoWidth) return;
        ctx.strokeStyle = theme.strokeStyle || "#ff0000";
        ctx.lineWidth = theme.lineWidth || 3;
        ctx.lineCap = theme.lineCap || "round";
        ctx.beginPath();
        const p0 = videoUVToCanvasPoint(canvas, videoEl, pts[0].u, pts[0].v);
        if (!p0) return;
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < pts.length; i++) {
          const pi = videoUVToCanvasPoint(canvas, videoEl, pts[i].u, pts[i].v);
          if (!pi) return;
          ctx.lineTo(pi.x, pi.y);
        }
        ctx.stroke();
        return;
      }

      const cw = stroke.canvasSize?.width || canvas.width;
      const ch = stroke.canvasSize?.height || canvas.height;
      const sx = canvas.width / (cw || 1);
      const sy = canvas.height / (ch || 1);
      ctx.strokeStyle = theme.strokeStyle || "#ff0000";
      ctx.lineWidth = theme.lineWidth || 3;
      ctx.lineCap = theme.lineCap || "round";
      ctx.beginPath();
      ctx.moveTo(pts[0].x * sx, pts[0].y * sy);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x * sx, pts[i].y * sy);
      }
      ctx.stroke();
    });
  };

  const serializeDrawingStroke = (stroke) => {
    if (stroke.kind === "shape") {
      if (stroke.coordSpace === "videoUv") {
        return JSON.stringify({
          kind: "shape",
          coordSpace: "videoUv",
          targetUserId: stroke.targetUserId,
          shape: stroke.shape,
          start: stroke.start,
          end: stroke.end,
        });
      }
      return JSON.stringify({
        kind: "shape",
        coordSpace: stroke.coordSpace || "canvasPx",
        shape: stroke.shape,
        start: stroke.start,
        end: stroke.end,
      });
    }
    if (stroke.coordSpace === "videoUv") {
      return JSON.stringify({
        kind: "freehand",
        coordSpace: "videoUv",
        targetUserId: stroke.targetUserId,
        points: stroke.points,
      });
    }
    const pts = stroke.points || stroke.path || [];
    return JSON.stringify(pts);
  };

  const handleUndo = () => {
    if (!isTrainerRole) return;
    if (!drawingHistoryRef.current.length) return;
    drawingHistoryRef.current = drawingHistoryRef.current.slice(0, -1);
    redrawLocalHistory();
    if (socket && fromUser?._id && toUser?._id) {
      socket.emit(EVENTS.EMIT_CLEAR_CANVAS, {
        userInfo: { from_user: fromUser._id, to_user: toUser._id },
        canvasIndex: 1,
      });
      const c = annotationCanvasRef.current;
      drawingHistoryRef.current.forEach((stroke) => {
        socket.emit(EVENTS.DRAW, {
          userInfo: { from_user: fromUser._id, to_user: toUser._id },
          strikes: serializeDrawingStroke(stroke),
          theme: stroke.theme,
          canvasSize: {
            width: c?.width || 0,
            height: c?.height || 0,
          },
          canvasIndex: 1,
        });
      });
    }
  };

  const handleUserClick = (id) => {
    if (isTrainerRole) {
      setSelectedUser(id);
      emitVideoSelectEvent("swap", id);
    }
  };

  // Socket event listeners for video select, annotations, and drawing mode
  useEffect(() => {
    if (!socket) return;

    const handleVideoSelect = ({ id, type }) => {
      if (type === "swap" && isTraineeRole) {
        setSelectedUser(id);
      }
    };

    const handleDrawingCoords = ({ strikes, canvasSize, canvasIndex, theme }) => {
      if (!isTraineeRole || canvasIndex !== 1) return;

      const canvas = annotationCanvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx || !canvas) return;

      let path;
      try {
        path = typeof strikes === "string" ? JSON.parse(strikes) : strikes;
      } catch {
        return;
      }

      try {
        if (
          path?.kind === "freehand" &&
          path.coordSpace === "videoUv" &&
          Array.isArray(path.points) &&
          path.points.length > 0
        ) {
          let attempts = 0;
          const step = () => {
            attempts += 1;
            const videoEl = resolveVideoElForTarget(
              path.targetUserId,
              fromUser,
              toUser,
              localVideoRef,
              remoteVideoRef
            );
            if (!videoEl?.videoWidth || !path.points.length) {
              if (attempts < 55) requestAnimationFrame(step);
              return;
            }
            const t = scaleStrokeTheme(theme, canvasSize, canvas);
            ctx.strokeStyle = t.strokeStyle;
            ctx.lineWidth = t.lineWidth;
            ctx.lineCap = t.lineCap;
            ctx.beginPath();
            const p0 = videoUVToCanvasPoint(canvas, videoEl, path.points[0].u, path.points[0].v);
            if (!p0) {
              if (attempts < 55) requestAnimationFrame(step);
              return;
            }
            ctx.moveTo(p0.x, p0.y);
            for (let i = 1; i < path.points.length; i++) {
              const pi = videoUVToCanvasPoint(canvas, videoEl, path.points[i].u, path.points[i].v);
              if (!pi) return;
              ctx.lineTo(pi.x, pi.y);
            }
            ctx.stroke();
          };
          step();
          return;
        }

        if (
          path?.kind === "shape" &&
          path.coordSpace === "videoUv" &&
          path.start &&
          path.end
        ) {
          let attempts = 0;
          const step = () => {
            attempts += 1;
            const videoEl = resolveVideoElForTarget(
              path.targetUserId,
              fromUser,
              toUser,
              localVideoRef,
              remoteVideoRef
            );
            if (!videoEl?.videoWidth) {
              if (attempts < 55) requestAnimationFrame(step);
              return;
            }
            const t = scaleStrokeTheme(theme, canvasSize, canvas);
            const scaledStart = videoUVToCanvasPoint(
              canvas,
              videoEl,
              path.start.u,
              path.start.v
            );
            const scaledEnd = videoUVToCanvasPoint(canvas, videoEl, path.end.u, path.end.v);
            if (!scaledStart || !scaledEnd) {
              if (attempts < 55) requestAnimationFrame(step);
              return;
            }
            drawShapeOnCtx(ctx, path.shape, scaledStart, scaledEnd, t);
          };
          step();
          return;
        }

        if (path?.kind === "shape" && path?.start && path?.end) {
          const scaleX = canvas.width / (canvasSize?.width || canvas.width);
          const scaleY = canvas.height / (canvasSize?.height || canvas.height);
          const scaledStart = {
            x: path.start.x * scaleX,
            y: path.start.y * scaleY,
          };
          const scaledEnd = {
            x: path.end.x * scaleX,
            y: path.end.y * scaleY,
          };
          drawShapeOnCtx(
            ctx,
            path.shape,
            scaledStart,
            scaledEnd,
            scaleStrokeTheme(theme, canvasSize, canvas)
          );
          return;
        }

        if (Array.isArray(path) && path.length > 0) {
          const scaleX = canvas.width / (canvasSize?.width || canvas.width);
          const scaleY = canvas.height / (canvasSize?.height || canvas.height);
          const t = scaleStrokeTheme(theme, canvasSize, canvas);
          ctx.strokeStyle = t.strokeStyle;
          ctx.lineWidth = t.lineWidth;
          ctx.lineCap = t.lineCap;
          ctx.beginPath();
          ctx.moveTo(path[0].x * scaleX, path[0].y * scaleY);
          for (let i = 1; i < path.length; i++) {
            ctx.lineTo(path[i].x * scaleX, path[i].y * scaleY);
          }
          ctx.stroke();
        }
      } catch (err) {
        console.warn("Failed to parse drawing coordinates:", err);
      }
    };

    // Listen for clear canvas event
    const handleClearCanvas = ({ canvasIndex } = {}) => {
      // Accept canvasIndex === 1 (one-on-one) or undefined (legacy/no index = clear all)
      if (isTraineeRole && (canvasIndex === 1 || canvasIndex == null)) {
        const canvas = annotationCanvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (ctx && canvas) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    };

    // Listen for drawing mode toggle
    const handleToggleDrawingMode = ({ drawingMode }) => {
      if (isTraineeRole) {
        setIsAnnotating(drawingMode);
        setShowAnnotTools(false);
      }
    };

    socket.on(EVENTS.ON_VIDEO_SELECT, handleVideoSelect);
    socket.on(EVENTS.EMIT_DRAWING_CORDS, handleDrawingCoords);
    socket.on(EVENTS.ON_CLEAR_CANVAS, handleClearCanvas);
    socket.on(EVENTS.TOGGLE_DRAWING_MODE, handleToggleDrawingMode);

    return () => {
      if (socket) {
        socket.off(EVENTS.ON_VIDEO_SELECT, handleVideoSelect);
        socket.off(EVENTS.EMIT_DRAWING_CORDS, handleDrawingCoords);
        socket.off(EVENTS.ON_CLEAR_CANVAS, handleClearCanvas);
        socket.off(EVENTS.TOGGLE_DRAWING_MODE, handleToggleDrawingMode);
      }
    };
  }, [
    socket,
    isTraineeRole,
    fromUser,
    toUser,
    localVideoRef,
    remoteVideoRef,
    setSelectedUser,
    setIsAnnotating,
  ]);

  const emitVideoSelectEvent = (type, id) => {
    if (socket && fromUser?._id && toUser?._id) {
      socket.emit(EVENTS.ON_VIDEO_SELECT, {
        userInfo: { from_user: fromUser._id, to_user: toUser._id },
        type,
        id,
      });
    }
  };

  /** Fixed on the call surface (not inside Draggable UserBox) so it is always visible for trainers. */
  const trainerAnnotationToolbar =
    isTrainerRole ? (
      <div
        className="hide-in-screenshot"
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          zIndex: 20000,
          maxWidth: "calc(100vw - 16px)",
          boxSizing: "border-box",
          pointerEvents: "none",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            gap: 6,
            padding: "6px",
            borderRadius: 50,
            background: "rgba(255, 255, 255, 0.96)",
            border: "1px solid rgba(15, 23, 42, 0.08)",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.12)",
            backdropFilter: "blur(10px)",
            boxSizing: "border-box",
          }}
        >
          <button
            type="button"
            aria-pressed={isAnnotating}
            aria-label={isAnnotating ? "Stop annotating" : "Start annotating on video"}
            onClick={() => {
              const newMode = !isAnnotating;
              setIsAnnotating(newMode);
              setShowAnnotTools(newMode);
              if (socket && fromUser?._id && toUser?._id) {
                socket.emit(EVENTS.TOGGLE_DRAWING_MODE, {
                  userInfo: { from_user: fromUser._id, to_user: toUser._id },
                  drawingMode: newMode,
                });
              }
            }}
            onMouseEnter={(e) => {
              if (!isAnnotating) {
                e.currentTarget.style.borderColor = "#2196f3";
                e.currentTarget.style.background = "#e3f2fd";
              }
              e.currentTarget.style.transform = "scale(1.05)";
            }}
            onMouseLeave={(e) => {
              if (!isAnnotating) {
                e.currentTarget.style.borderColor = "#e0e0e0";
                e.currentTarget.style.background = "#f5f5f5";
              }
              e.currentTarget.style.transform = "scale(1)";
            }}
            style={{
              width: 44,
              height: 44,
              flexShrink: 0,
              borderRadius: "50%",
              border: `2px solid ${isAnnotating ? "#1976d2" : "#e0e0e0"}`,
              backgroundColor: isAnnotating ? "#2196f3" : "#f5f5f5",
              color: isAnnotating ? "#ffffff" : "#333333",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
            title={isAnnotating ? "Stop annotation" : "Annotate on video"}
          >
            <PenTool size={20} color={isAnnotating ? "#ffffff" : "#333333"} strokeWidth={isAnnotating ? 2.25 : 2} />
          </button>
        </div>
        {isAnnotating && showAnnotTools && (
          <div
            style={{
              pointerEvents: "auto",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: 14,
              background: "rgba(255, 255, 255, 0.98)",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.14)",
              width: "fit-content",
              maxWidth: "calc(100vw - 80px)",
              overflowX: "auto",
              overflowY: "hidden",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <CanvasMenuBar
              isOpen={isCanvasMenuOpen}
              setIsOpen={setIsCanvasMenuOpen}
              setSketchPickerColor={() => {}}
              isFromPotrait={true}
              sketchPickerColor={{}}
              canvasConfigs={canvasConfigs}
              setCanvasConfigs={setCanvasConfigs}
              drawShapes={(shapeType) => {
                if (!shapeType) {
                  setSelectedShape(SHAPES.FREE_HAND);
                  return;
                }
                setSelectedShape(shapeType);
              }}
              refreshDrawing={clearAnnotations}
              undoDrawing={handleUndo}
              selectedClips={[]}
              setSelectedClips={() => {}}
              toUser={toUser}
              isCanvasMenuNoteShow={isCanvasMenuNoteShow}
              setIsCanvasMenuNoteShow={setIsCanvasMenuNoteShow}
              setMicNote={setMicNote}
              setClipSelectNote={setClipSelectNote}
              clipSelectNote={clipSelectNote}
              setCountClipNoteOpen={setCountClipNoteOpen}
              resetInitialPinnedUser={() => {}}
              isFullScreen={false}
            />
          </div>
        )}
      </div>
    ) : null;

  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      height: "100%", 
      maxHeight: "100%", 
      overflow: "hidden",
      width: "100%",
      boxSizing: "border-box"
    }}>
      <div 
        className="d-flex w-100 justify-content-end mr-3 mr-md-5"
        style={{
          padding: "6px 12px 4px",
          flexShrink: 0,
          boxSizing: "border-box",
        }}
      >
        {(timeRemaining != null || bufferSecondsRemaining != null || !bothUsersJoined) && (
          <TimeRemaining
            timeRemaining={timeRemaining}
            bothUsersJoined={bothUsersJoined}
            bufferSecondsRemaining={bufferSecondsRemaining}
            showCoachControls={isTrainerRole}
            lessonTimerVariant={lessonTimerVariant}
            lessonTimerStatus={lessonTimerStatus}
            onStartTimer={onStartTimer}
            onPauseTimer={onPauseTimer}
            onResumeTimer={onResumeTimer}
          />
        )}
      </div>

      <div
        ref={videoSectionRef}
        className="video-section video-section-one-on-one one-on-one-layout"
        style={{
        position: "relative",
        flex: 1,
        minHeight: 0,
        maxHeight: "100%", // Keep max-height at 100% for one-on-one call
        overflow: "hidden",
        boxSizing: "border-box",
        padding: "0 8px"
      }}
      >
        {trainerAnnotationToolbar}
        <div
          className="one-on-one-layout__zoom-sync"
          style={{
            position: "relative",
            flex: 1,
            minHeight: 0,
            width: "100%",
            display: "flex",
            flexDirection: isLandscape ? "row" : "column",
            gap: isLandscape ? 12 : 10,
            alignItems: "stretch",
            transform: `translate(${zoomPan.translate.x}px, ${zoomPan.translate.y}px) scale(${zoomPan.scale})`,
            transformOrigin: "center center",
            touchAction: isTrainerRole && sessionId ? "none" : "auto",
          }}
          onWheel={handleZoomWheel}
          onMouseDown={handleZoomPanMouseDown}
          onTouchStart={handleZoomTouchStart}
          onTouchMove={handleZoomTouchMove}
          onTouchEnd={handleZoomTouchEnd}
        >
          <div className="one-on-one-layout__primary">
            <UserBox
              id={fromUser._id}
              onClick={handleUserClick}
              selected={selectedUser === fromUser._id}
              selectedUser={selectedUser}
              notSelected={selectedUser}
              videoRef={localVideoRef}
              user={fromUser}
              stream={localStream}
              isStreamOff={isLocalStreamOff}
              isLandscape={isLandscape}
              muted={true}
              disablePositionDrag
            />
          </div>
          <div className="one-on-one-layout__secondary">
            <UserBox
              id={toUser._id}
              onClick={handleUserClick}
              selectedUser={selectedUser}
              selected={selectedUser === toUser._id}
              notSelected={selectedUser}
              videoRef={remoteVideoRef}
              user={toUser}
              stream={remoteStream}
              isStreamOff={isRemoteStreamOff}
              isLandscape={isLandscape}
              disablePositionDrag
            />
          </div>

          {selectedUser && (
            <UserBoxMini
              id={selectedUser === fromUser._id ? toUser._id : fromUser._id}
              onClick={handleUserClick}
              selected={false}
              videoRef={selectedUser === fromUser._id ? remoteVideoRef : localVideoRef}
              stream={selectedUser === fromUser._id ? remoteStream : localStream}
              user={selectedUser === fromUser._id ? toUser : fromUser}
              isStreamOff={
                selectedUser === fromUser._id ? isRemoteStreamOff : isLocalStreamOff
              }
              muted={selectedUser === fromUser._id ? false : true}
              videoType={selectedUser === fromUser._id ? "student" : "teacher"}
              onHide={handleHideVideo}
              onRestore={handleRestoreVideo}
              isHidden={
                selectedUser === fromUser._id ? hiddenVideos.student : hiddenVideos.teacher
              }
              disablePositionDrag
            />
          )}

          {/* Same transform as videos so annotations align when zoomed/panned */}
          <canvas
            ref={annotationCanvasRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "transparent",
              pointerEvents:
                isTrainerRole && isAnnotating ? "auto" : "none",
              cursor: isTrainerRole && isAnnotating ? "crosshair" : "default",
              zIndex: 50,
            }}
            onWheel={(e) => {
              if (isTrainerRole && isAnnotating) e.stopPropagation();
            }}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          />
        </div>
      </div>
      <InstantLessonRecordingBar
        isInstantLesson={isInstantLesson}
        sessionId={sessionId}
        fromUser={fromUser}
        toUser={toUser}
        lessonTimerStatus={lessonTimerStatus}
        localVideoRef={localVideoRef}
        remoteVideoRef={remoteVideoRef}
        isLandscape={isLandscape}
        isTrainerRole={isTrainerRole}
      />
    </div>
  );
};

export default OneOnOneCall;
