import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { SocketContext } from "../socket";
import { EVENTS } from "../../../helpers/events";
import { addSessionRecording } from "../videoupload/videoupload.api";
import { pushSessionRecordingToS3 } from "../common/common.api";

const OUT_W = 960;

function pickMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (let i = 0; i < candidates.length; i += 1) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidates[i])) {
      return candidates[i];
    }
  }
  return "video/webm";
}

function drawCover(ctx, video, x, y, cw, ch) {
  if (!video || !video.videoWidth || !video.videoHeight || cw <= 0 || ch <= 0) return;
  const vr = video.videoWidth / video.videoHeight;
  const cr = cw / ch;
  let dw;
  let dh;
  let ox;
  let oy;
  if (vr > cr) {
    dh = ch;
    dw = ch * vr;
    ox = x + (cw - dw) / 2;
    oy = y;
  } else {
    dw = cw;
    dh = cw / vr;
    ox = x;
    oy = y + (ch - dh) / 2;
  }
  ctx.drawImage(video, ox, oy, dw, dh);
}

/**
 * Instant lesson only: optional full-session recording (trainer captures composited local+remote).
 * Starts with the lesson timer when the opt-in box is checked; uploads WebM when the lesson ends.
 */
export default function InstantLessonRecordingBar({
  isInstantLesson,
  sessionId,
  fromUser,
  toUser,
  lessonTimerStatus = "waiting",
  localVideoRef,
  remoteVideoRef,
  isLandscape,
  isTrainerRole,
}) {
  const socket = useContext(SocketContext);
  const [recordOptIn, setRecordOptIn] = useState(false);
  const [peerWantsRecording, setPeerWantsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recordingUi, setRecordingUi] = useState(false);

  const recordingActiveRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const canvasRef = useRef(null);
  const canvasStreamRef = useRef(null);
  const rafRef = useRef(null);
  const prevTimerRef = useRef(lessonTimerStatus);
  const mimeRef = useRef(null);

  const traineeId = isTrainerRole ? toUser?._id : fromUser?._id;

  useEffect(() => {
    if (!isInstantLesson || !socket || !fromUser?._id || !toUser?._id) return undefined;
    const ev = EVENTS.INSTANT_LESSON.SESSION_RECORDING;
    const handler = (payload) => {
      if (!payload || String(payload.sessionId) !== String(sessionId)) return;
      setPeerWantsRecording(!!payload.enabled);
    };
    socket.on(ev, handler);
    return () => {
      socket.off(ev, handler);
    };
  }, [isInstantLesson, socket, fromUser?._id, toUser?._id, sessionId]);

  useEffect(() => {
    if (!isInstantLesson || !socket || !fromUser?._id || !toUser?._id) return;
    socket.emit(EVENTS.INSTANT_LESSON.SESSION_RECORDING, {
      userInfo: { from_user: fromUser._id, to_user: toUser._id },
      sessionId,
      enabled: !!recordOptIn,
    });
  }, [recordOptIn, isInstantLesson, socket, sessionId, fromUser?._id, toUser?._id]);

  const cleanupCapture = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (canvasStreamRef.current) {
      canvasStreamRef.current.getTracks().forEach((t) => t.stop());
      canvasStreamRef.current = null;
    }
    canvasRef.current = null;
  }, []);

  const stopRecorderInternal = useCallback(
    (uploadAfterStop) =>
      new Promise((resolve) => {
        const mr = mediaRecorderRef.current;
        if (!mr || mr.state === "inactive") {
          cleanupCapture();
          recordingActiveRef.current = false;
          setRecordingUi(false);
          resolve(null);
          return;
        }
        mr.onstop = async () => {
          cleanupCapture();
          mediaRecorderRef.current = null;
          recordingActiveRef.current = false;
          setRecordingUi(false);
          const chunks = chunksRef.current;
          chunksRef.current = [];
          if (!uploadAfterStop || !chunks.length) {
            resolve(null);
            return;
          }
          try {
            setUploading(true);
            const blob = new Blob(chunks, { type: mimeRef.current || "video/webm" });
            const apiRes = await addSessionRecording({
              sessions: sessionId,
              trainee: traineeId,
            });
            const payload = apiRes?.data ?? apiRes?.result ?? apiRes;
            const url = payload?.url;
            if (!url) {
              toast.error("Could not prepare upload for session recording.");
              resolve(null);
              return;
            }
            await pushSessionRecordingToS3(url, blob);
            toast.success("Session recording saved. You can open it from Locker → Game plans.");
          } catch (e) {
            console.error("[InstantLessonRecording]", e);
            toast.error(
              e?.response?.data?.error ||
                e?.message ||
                "Failed to upload session recording."
            );
          } finally {
            setUploading(false);
            resolve(null);
          }
        };
        try {
          if (mr.state === "recording") {
            try {
              mr.requestData();
            } catch (_) {}
          }
          mr.stop();
        } catch (e) {
          cleanupCapture();
          mediaRecorderRef.current = null;
          recordingActiveRef.current = false;
          resolve(null);
        }
      }),
    [cleanupCapture, sessionId, traineeId]
  );

  const startRecording = useCallback(() => {
    if (
      !isInstantLesson ||
      !isTrainerRole ||
      !recordOptIn ||
      typeof MediaRecorder === "undefined"
    ) {
      return;
    }
    const vLoc = localVideoRef?.current;
    const vRem = remoteVideoRef?.current;
    if (!vLoc || !vRem) {
      toast.warn("Cameras not ready yet — recording will start when video is available.");
      return;
    }
    if (recordingActiveRef.current) return;

    mimeRef.current = pickMimeType();
    const canvas = document.createElement("canvas");
    canvasRef.current = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      toast.error("Cannot capture session — canvas unsupported.");
      return;
    }

    const layoutFrame = () => {
      const lw = vLoc.videoWidth || 640;
      const lh = vLoc.videoHeight || 480;
      const rw = vRem.videoWidth || 640;
      const rh = vRem.videoHeight || 480;

      if (isLandscape) {
        const aspect = Math.max(lw / lh, rw / rh);
        canvas.width = OUT_W;
        canvas.height = Math.round((OUT_W / 2 / aspect) * 2);
      } else {
        const aspect =
          (lw / lh + rw / rh) / 2 ||
          16 / 9;
        canvas.width = OUT_W;
        canvas.height = Math.round((OUT_W / aspect) * 2);
      }
    };

    const tick = () => {
      const c = canvasRef.current;
      const loc = localVideoRef?.current;
      const rem = remoteVideoRef?.current;
      if (!c || !ctx || !loc || !rem || !recordingActiveRef.current) return;

      if (
        loc.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        rem.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        if (!canvas.width || !canvas.height) layoutFrame();
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, c.width, c.height);
        if (isLandscape) {
          const half = c.width / 2;
          drawCover(ctx, loc, 0, 0, half, c.height);
          drawCover(ctx, rem, half, 0, half, c.height);
        } else {
          const halfH = c.height / 2;
          drawCover(ctx, loc, 0, 0, c.width, halfH);
          drawCover(ctx, rem, 0, halfH, c.width, halfH);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    try {
      layoutFrame();
      tick();

      const stream = canvas.captureStream(30);
      canvasStreamRef.current = stream;

      chunksRef.current = [];
      const mr = new MediaRecorder(stream, {
        mimeType: mimeRef.current,
        videoBitsPerSecond: 2_500_000,
      });
      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      mr.start(1000);
      mediaRecorderRef.current = mr;
      recordingActiveRef.current = true;
      setRecordingUi(true);
    } catch (e) {
      console.error("[InstantLessonRecording] start failed", e);
      cleanupCapture();
      recordingActiveRef.current = false;
      toast.error("Recording could not start in this browser.");
    }
  }, [
    cleanupCapture,
    isInstantLesson,
    isLandscape,
    isTrainerRole,
    localVideoRef,
    recordOptIn,
    remoteVideoRef,
  ]);

  useEffect(() => {
    if (!isInstantLesson || !isTrainerRole || !recordOptIn) return undefined;

    const handler = (e) => {
      if (recordingActiveRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isInstantLesson, isTrainerRole, recordOptIn]);

  useEffect(() => {
    if (!isInstantLesson || !isTrainerRole) return;

    const prev = prevTimerRef.current;
    prevTimerRef.current = lessonTimerStatus;

    if (!recordOptIn) return;

    if (lessonTimerStatus === "running") {
      if (!recordingActiveRef.current) startRecording();
    }

    const mr = mediaRecorderRef.current;
    if (mr && mr.state === "recording" && lessonTimerStatus === "paused") {
      try {
        mr.pause();
      } catch (_) {}
    }
    if (mr && mr.state === "paused" && lessonTimerStatus === "running") {
      try {
        mr.resume();
      } catch (_) {}
    }

    if (lessonTimerStatus === "ended") {
      void stopRecorderInternal(true);
    }

    if (lessonTimerStatus === "waiting" && prev === "running") {
      void stopRecorderInternal(false);
    }
  }, [
    isInstantLesson,
    isTrainerRole,
    lessonTimerStatus,
    recordOptIn,
    startRecording,
    stopRecorderInternal,
  ]);

  useEffect(() => {
    if (!isInstantLesson || !isTrainerRole) return;
    if (!recordOptIn && recordingActiveRef.current) {
      void stopRecorderInternal(false);
    }
  }, [recordOptIn, isInstantLesson, isTrainerRole, stopRecorderInternal]);

  useEffect(() => {
    return () => {
      void stopRecorderInternal(false);
    };
  }, [stopRecorderInternal]);

  if (!isInstantLesson) return null;

  const supported =
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    HTMLCanvasElement.prototype.captureStream;

  return (
    <div
      className="instant-lesson-recording-bar hide-in-screenshot"
      style={{
        flexShrink: 0,
        width: "100%",
        boxSizing: "border-box",
        padding: "8px 12px",
        borderTop: "1px solid rgba(15, 23, 42, 0.08)",
        background: "rgba(248, 250, 252, 0.97)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {!supported ? (
        <span style={{ fontSize: 12, color: "#b45309" }}>
          Session recording is not supported in this browser. Try Chrome or Edge on desktop.
        </span>
      ) : isTrainerRole ? (
        <>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              fontSize: 13,
              color: "#334155",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={recordOptIn}
              disabled={uploading || lessonTimerStatus === "ended"}
              onChange={(e) => setRecordOptIn(e.target.checked)}
            />
            <span>
              <strong>Record this session</strong>
              {" — Starts when the lesson timer starts; saved to Locker → Game plans when the lesson ends."}
            </span>
          </label>
          {recordingUi && recordOptIn && (
            <span style={{ fontSize: 12, color: "#b91c1c", fontWeight: 600 }}>
              ● Recording in progress
              {uploading ? " — Uploading recording…" : ""}
            </span>
          )}
        </>
      ) : (
        <span style={{ fontSize: 13, color: "#334155" }}>
          {peerWantsRecording ? (
            <strong style={{ color: "#b91c1c" }}>● This instant lesson is being recorded.</strong>
          ) : (
            <>The expert can choose to record this session. If enabled, you will both see the video in Locker after the lesson.</>
          )}
        </span>
      )}
    </div>
  );
}
