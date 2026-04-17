import { useContext, useEffect, useRef, useState } from "react";
import { EVENTS } from "../../../helpers/events";
import { AccountType, SHAPES } from "../../common/constants";
import { useAppSelector } from "../../store";
import { authState } from "../auth/auth.slice";
import TimeRemaining from "./time-remaining";
import { UserBox, UserBoxMini } from "./user-box";
import { SocketContext } from "../socket";
import { PenTool } from "react-feather";
import { CanvasMenuBar } from "../video/canvas.menubar";

const OneOnOneCall = ({
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
        const head = 10;
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

  const handlePointerDown = (e) => {
    if (accountType !== AccountType.TRAINER || !isAnnotating) return;
    e.preventDefault();
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCanvasPos(e);
    // Use current canvas configuration (color / width) similar to clip mode
    ctx.strokeStyle = canvasConfigs?.sender?.strokeStyle || "#ff0000";
    ctx.lineWidth = canvasConfigs?.sender?.lineWidth || 3;
    ctx.lineCap = "round";
    if (selectedShape === SHAPES.FREE_HAND || !selectedShape) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      lastPosRef.current = { x, y };
      drawingPathRef.current = [{ x, y }]; // Start new path
    } else {
      shapeStartRef.current = { x, y };
      shapeCurrentRef.current = { x, y };
      shapeSnapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
    setIsDrawing(true);
  };

  const handlePointerMove = (e) => {
    if (!isDrawing || accountType !== AccountType.TRAINER || !isAnnotating) return;
    e.preventDefault();
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCanvasPos(e);
    if (selectedShape === SHAPES.FREE_HAND || !selectedShape) {
      ctx.lineTo(x, y);
      ctx.stroke();
      lastPosRef.current = { x, y };
      drawingPathRef.current.push({ x, y }); // Add point to path
    } else if (shapeStartRef.current) {
      shapeCurrentRef.current = { x, y };
      if (shapeSnapshotRef.current) {
        ctx.putImageData(shapeSnapshotRef.current, 0, 0);
      }
      drawShapeOnCtx(
        ctx,
        selectedShape,
        shapeStartRef.current,
        shapeCurrentRef.current,
        {
          strokeStyle: canvasConfigs?.sender?.strokeStyle || "#ff0000",
          lineWidth: canvasConfigs?.sender?.lineWidth || 3,
          lineCap: "round",
        }
      );
    }
  };

  const handlePointerUp = (e) => {
    if (!isDrawing) return;
    e && e.preventDefault();
    
    // Send drawing path to student via socket (lightweight path payload).
    // Avoid sending full-canvas base64 data which can freeze/blank live call UIs.
    if (accountType === AccountType.TRAINER && socket && fromUser?._id && toUser?._id) {
      const canvas = annotationCanvasRef.current;
      if (canvas) {
        const theme = {
          strokeStyle: canvasConfigs?.sender?.strokeStyle || "#ff0000",
          lineWidth: canvasConfigs?.sender?.lineWidth || 3,
          lineCap: "round",
        };
        if ((selectedShape === SHAPES.FREE_HAND || !selectedShape) && drawingPathRef.current.length > 0) {
          drawingHistoryRef.current.push({
            path: [...drawingPathRef.current],
            theme,
            kind: "freehand",
          });
          socket.emit(EVENTS.DRAW, {
            userInfo: { from_user: fromUser._id, to_user: toUser._id },
            strikes: JSON.stringify(drawingPathRef.current),
            theme,
            canvasSize: { width: canvas.width, height: canvas.height },
            canvasIndex: 1,
          });
        } else if (shapeStartRef.current && shapeCurrentRef.current) {
          const shapePayload = {
            kind: "shape",
            shape: selectedShape,
            start: shapeStartRef.current,
            end: shapeCurrentRef.current,
          };
          drawingHistoryRef.current.push({
            ...shapePayload,
            theme,
          });
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
    
    drawingPathRef.current = []; // Clear path
    shapeStartRef.current = null;
    shapeCurrentRef.current = null;
    shapeSnapshotRef.current = null;
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
    if (accountType === AccountType.TRAINER && socket && fromUser?._id && toUser?._id) {
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
      if (stroke?.kind === "shape") {
        drawShapeOnCtx(ctx, stroke.shape, stroke.start, stroke.end, theme);
        return;
      }
      const path = stroke?.path || [];
      if (!Array.isArray(path) || path.length === 0) return;
      ctx.strokeStyle = theme.strokeStyle || "#ff0000";
      ctx.lineWidth = theme.lineWidth || 3;
      ctx.lineCap = theme.lineCap || "round";
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
      }
      ctx.stroke();
    });
  };

  const handleUndo = () => {
    if (accountType !== AccountType.TRAINER) return;
    if (!drawingHistoryRef.current.length) return;
    drawingHistoryRef.current = drawingHistoryRef.current.slice(0, -1);
    redrawLocalHistory();
    if (socket && fromUser?._id && toUser?._id) {
      socket.emit(EVENTS.EMIT_CLEAR_CANVAS, {
        userInfo: { from_user: fromUser._id, to_user: toUser._id },
        canvasIndex: 1,
      });
      drawingHistoryRef.current.forEach((stroke) => {
        socket.emit(EVENTS.DRAW, {
          userInfo: { from_user: fromUser._id, to_user: toUser._id },
          strikes:
            stroke?.kind === "shape"
              ? JSON.stringify({
                  kind: "shape",
                  shape: stroke.shape,
                  start: stroke.start,
                  end: stroke.end,
                })
              : JSON.stringify(stroke.path),
          theme: stroke.theme,
          canvasSize: {
            width: annotationCanvasRef.current?.width || 0,
            height: annotationCanvasRef.current?.height || 0,
          },
          canvasIndex: 1,
        });
      });
    }
  };

  const handleUserClick = (id) => {
    if (accountType === AccountType.TRAINER) {
      setSelectedUser(id);
      emitVideoSelectEvent("swap", id);
    }
  };

  // Socket event listeners for video select, annotations, and drawing mode
  useEffect(() => {
    if (!socket) return;

    const handleVideoSelect = ({ id, type }) => {
      if (type === "swap" && accountType === AccountType.TRAINEE) {
        setSelectedUser(id);
      }
    };

    // Listen for annotation drawing from trainer
    const handleDrawingCoords = ({ strikes, canvasSize, canvasIndex, theme }) => {
      if (accountType === AccountType.TRAINEE && canvasIndex === 1) {
        const canvas = annotationCanvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!ctx || !canvas) return;
        
        try {
          // Handle path coordinates format
          let path;
          if (typeof strikes === 'string') {
            try {
              path = JSON.parse(strikes);
            } catch {
              return;
            }
          } else {
            path = strikes;
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
              {
                strokeStyle: theme?.strokeStyle || "#ff0000",
                lineWidth: theme?.lineWidth || 3,
                lineCap: theme?.lineCap || "round",
              }
            );
          } else if (Array.isArray(path) && path.length > 0) {
            // Scale coordinates if canvas sizes differ
            const scaleX = canvas.width / (canvasSize?.width || canvas.width);
            const scaleY = canvas.height / (canvasSize?.height || canvas.height);

            ctx.strokeStyle = theme?.strokeStyle || "#ff0000";
            ctx.lineWidth = theme?.lineWidth || 3;
            ctx.lineCap = theme?.lineCap || "round";
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
      }
    };

    // Listen for clear canvas event
    const handleClearCanvas = ({ canvasIndex }) => {
      if (accountType === AccountType.TRAINEE && canvasIndex === 1) {
        const canvas = annotationCanvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (ctx && canvas) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    };

    // Listen for drawing mode toggle
    const handleToggleDrawingMode = ({ drawingMode }) => {
      if (accountType === AccountType.TRAINEE) {
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
  }, [socket, accountType, fromUser?._id, toUser?._id, setSelectedUser, setIsAnnotating]);

  const emitVideoSelectEvent = (type, id) => {
    if (socket && fromUser?._id && toUser?._id) {
      socket.emit(EVENTS.ON_VIDEO_SELECT, {
        userInfo: { from_user: fromUser._id, to_user: toUser._id },
        type,
        id,
      });
    }
  };

  const trainerAnnotationOverlay =
    accountType === AccountType.TRAINER ? (
      <div
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          pointerEvents: "auto",
        }}
      >
        <button
          type="button"
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
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "50%",
            border: `2px solid ${isAnnotating ? "#2196f3" : "#e0e0e0"}`,
            backgroundColor: isAnnotating ? "#2196f3" : "#f5f5f5",
            color: isAnnotating ? "#ffffff" : "#333333",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
            cursor: "pointer",
            transition: "all 0.3s ease",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            justifyContent: "center",
            padding: 0,
          }}
          title={isAnnotating ? "Stop annotation" : "Start annotation"}
        >
          <PenTool size={18} color={isAnnotating ? "#ffffff" : "#333333"} />
        </button>
        {isAnnotating && showAnnotTools && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 6px",
              borderRadius: "18px",
              background: "rgba(255,255,255,0.95)",
              border: "1px solid #e5e7eb",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.12)",
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
            showCoachControls={accountType === AccountType.TRAINER}
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
          topLeftOverlay={selectedUser === fromUser._id ? trainerAnnotationOverlay : null}
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
          topLeftOverlay={selectedUser === toUser._id ? trainerAnnotationOverlay : null}
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
            isHidden={selectedUser === fromUser._id ? hiddenVideos.student : hiddenVideos.teacher}
          />
        )}

      {/* Annotation canvas overlay for trainer */}
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
              accountType === AccountType.TRAINER && isAnnotating ? "auto" : "none",
            zIndex: 110,
          }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        />

        {/* Annotation controls now live inside selected big UserBox for parity with clip mode UX. */}
      </div>
    </div>
  );
};

export default OneOnOneCall;
