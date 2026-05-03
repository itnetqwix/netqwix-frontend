import Draggable from "react-draggable";
import { Point, Utils } from "../../../utils/utils";
import React, { useEffect, useState, useRef } from "react";
import { useCallback } from "react";
import { AccountType } from "../../common/constants";
import { ChevronRight } from "react-feather";

/** Parent refs (e.g. portrait-calling localVideoRef / remoteVideoRef) must point at the <video> for PeerJS and stream sync. */
function assignForwardedVideoRef(videoRef, node) {
  if (videoRef == null) return;
  if (typeof videoRef === "function") {
    videoRef(node);
  } else {
    try {
      videoRef.current = node;
    } catch {
      /* read-only ref */
    }
  }
}

export const UserBox = ({
  onClick,
  selected,
  id,
  notSelected,
  videoRef,
  user,
  stream,
  isStreamOff,
  selectedUser,
  isLandscape,
  muted,
  onHide,
  onRestore,
  isHidden,
  videoType,
  topLeftOverlay = null,
  /** When true, large selected video stays fixed (no drag reposition). Zoom is unchanged elsewhere. */
  disablePositionDrag = false,
}) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  // Internal ref so this instance always attaches stream to its own <video> (parent may share one ref across multiple boxes)
  const videoElRef = useRef(null);
  const effectiveStream = stream || null;

  const setVideoRef = useCallback(
    (node) => {
      videoElRef.current = node;
      assignForwardedVideoRef(videoRef, node);
      if (node && effectiveStream) node.srcObject = effectiveStream;
    },
    [effectiveStream, videoRef]
  );
  useEffect(() => {
    const el = videoElRef.current;
    if (!el) return;

    if (effectiveStream) {
      if (el.srcObject !== effectiveStream) {
        el.srcObject = effectiveStream;
      }
      if (el.paused) {
        el.play().catch((err) => {
          if (err?.name !== "AbortError") {
            console.warn("[UserBox] Failed to play video", { userId: user?._id, err });
          }
        });
      }
    } else {
      if (el.srcObject) el.srcObject = null;
    }
  }, [effectiveStream, isStreamOff, selectedUser, user?._id, videoType]);

  const handleDrag = (e, data) => {
    setIsDragging(true);
    setPosition({ x: data.x, y: data.y });
  };

  const handleStop = (e, data) => {
    // Just stop dragging and keep the last position; do not hide at edges.
    setIsDragging(false);
    setPosition({ x: data.x, y: data.y });
  };

  const handleRestore = () => {
    // Restore now simply recenters the box; no edge-hiding UI anymore.
    setPosition({ x: 0, y: 0 });
  };

  const handleBoxClick = useCallback(() => {
    if (onClick && id && !isDragging && !selected) {
      onClick(id);
    }
  }, [onClick, id, isDragging, selected]);

  const clickObserver = useClickObserver(handleBoxClick);

  // We no longer support edge-hiding; always render the normal box content.

  const boxContent = (
    <div
      ref={containerRef}
      className={`${false ? "" : "profile-box"} ${
        notSelected && (selected ? "selected" : "hidden")
      }`}
      style={{
        position: "relative",
        width: selected ? "100vw" : (isLandscape ? "50vw" : "95vw"),
        cursor:
          selected && disablePositionDrag
            ? "default"
            : selected && onHide
              ? (isDragging ? "grabbing" : "grab")
              : "pointer",
        transition: isDragging ? "none" : "all 0.2s ease",
      }}
      onClick={() => !selected && onClick(id)}
    >
      {!isStreamOff ? (
        <video
          playsInline
          autoPlay
          muted={muted}
          ref={setVideoRef}
          style={{
            height: "100%",
            width: "100%",
            position: "absolute",
            objectFit: "cover",
            borderRadius: "20px",
          }}
        ></video>
      ) : Utils.pickProfileImageKey(user) ? (
        <>
          <img
            src={Utils.getProfileImageSrc(user)}
            alt=""
            className={`profile-img `}
            decoding="async"
            loading="eager"
          />
          <p className="profile-name">{user?.fullname}</p>
        </>
      ) : (
        <>
          <img
            src="/assets/images/demoUser.png"
            alt=""
            className={`profile-img `}
            decoding="async"
          />
          <p className="profile-name">{user?.fullname}</p>
        </>
      )}
      {selected && topLeftOverlay ? (
        <div
          className="hide-in-screenshot"
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 120,
            pointerEvents: "auto",
          }}
        >
          {topLeftOverlay}
        </div>
      ) : null}
    </div>
  );

  // If selected, optionally allow drag reposition (disabled for one-on-one / clip live cameras).
  if (selected && !disablePositionDrag) {
    return (
      <Draggable
        position={position}
        onStart={clickObserver.onStart}
        onDrag={handleDrag}
        onStop={(e, data) => {
          clickObserver.onStop(e, data);
          handleStop(e, data);
        }}
        bounds="body"
      >
        {boxContent}
      </Draggable>
    );
  }

  return boxContent;
};

function useClickObserver(callback) {
  const dragStartPosRef = React.useRef(new Point());
  const onStart = (_, data) => {
    dragStartPosRef.current = new Point(data.x, data.y);
  };
  const onStop = (_, data) => {
    const dragStopPoint = new Point(data.x, data.y);
    if (Point.dist(dragStartPosRef.current, dragStopPoint) < 5) {
      callback();
    }
  };
  return { onStart, onStop };
}

export const UserBoxMini = ({
  name,
  onClick,
  selected,
  id,
  videoRef: _ignoredVideoRef, // kept for call-site compatibility; must not assign parent refs
  /**
   * When provided, this mini box becomes the exclusive owner of the parent ref for
   * as long as it is mounted.  Only one box should receive this prop at a time — the
   * caller must pass `null` to other boxes so they never fight over the same ref.
   *
   * Use-case: in clip mode, when no full-size UserBox is rendered (selectedUser === null),
   * the mini remote-stream box is the only element that can keep remoteVideoRef populated.
   */
  primaryVideoRef = null,
  user,
  stream,
  isStreamOff,
  zIndex,
  bottom,
  muted,
  onHide,
  onRestore,
  isHidden,
  videoType, // 'student' | 'teacher'
  disablePositionDrag = false,
}) => {
  void _ignoredVideoRef;
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const videoElRef = useRef(null);
  const effectiveStream = stream || null;

  const handleBoxClick = useCallback(() => {
    if (onClick && id && !isDragging) {
      onClick(id);
    }
  }, [onClick, id, isDragging]);

  const clickObserver = useClickObserver(handleBoxClick);

  const setVideoRef = useCallback(
    (node) => {
      videoElRef.current = node;
      // Forward to the primaryVideoRef anchor so parent stream-attachment effects work.
      // Regular videoRef prop is still ignored to avoid ref conflicts when a full-size
      // UserBox is also rendered for the same stream.
      if (primaryVideoRef) assignForwardedVideoRef(primaryVideoRef, node);
      if (node && effectiveStream) node.srcObject = effectiveStream;
    },
    [effectiveStream, primaryVideoRef]
  );

  useEffect(() => {
    const el = videoElRef.current;
    if (!el) return;

    if (effectiveStream) {
      if (el.srcObject !== effectiveStream) el.srcObject = effectiveStream;
      if (el.paused) {
        el.play().catch((err) => {
          if (err?.name !== "AbortError") {
            console.warn("[UserBoxMini] Failed to play video", { userId: user?._id, err });
          }
        });
      }
    } else {
      if (el.srcObject) el.srcObject = null;
    }
  }, [effectiveStream, isStreamOff, isHidden, user?._id, videoType]);

  const handleDrag = (e, data) => {
    setIsDragging(true);
    setPosition({ x: data.x, y: data.y });
  };

  const handleStop = (e, data) => {
    // Just stop dragging and keep the last position; do not hide at edges.
    setIsDragging(false);
    setPosition({ x: data.x, y: data.y });
  };

  const miniInner = (
      <div 
        ref={containerRef}
        className={`profile-box mini hide-in-screenshot`} 
        style={{
          zIndex: zIndex ?? 100,
          bottom: bottom ?? 50,
          cursor: disablePositionDrag ? "pointer" : (isDragging ? "grabbing" : "grab"),
          transition: isDragging ? "none" : "all 0.2s ease",
        }}
      >
        {!isStreamOff ? (
          <video
            playsInline
            autoPlay
            muted={muted}
            ref={setVideoRef}
            style={{
              height: "100%",
              width: "100%",
              position: "absolute",
              objectFit: "cover",
              borderRadius: "20px",
            }}
          ></video>
        ) : Utils.pickProfileImageKey(user) ? (
          <>
            <img
              src={Utils.getProfileImageSrc(user)}
              alt=""
              className={`profile-img `}
              decoding="async"
              loading="eager"
            />
            <p className="profile-name">{user?.fullname}</p>
          </>
        ) : (
          <>
            <img
              src="/assets/images/demoUser.png"
              alt=""
              className={`profile-img `}
              decoding="async"
            />
            <p className="profile-name">{name}</p>
          </>
        )}
      </div>
  );

  if (disablePositionDrag) {
    return miniInner;
  }

  return (
    <Draggable
      position={position}
      onStart={clickObserver.onStart}
      onDrag={handleDrag}
      onStop={(e, data) => {
        clickObserver.onStop(e, data);
        handleStop(e, data);
      }}
      bounds="body"
    >
      {miniInner}
    </Draggable>
  );
};

export const VideoMiniBox = ({ onClick, id, clips, bottom, onHide, onRestore, isHidden }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  const handleBoxClick = useCallback(() => {
    if (onClick && !isDragging) {
      onClick(id);
    }
  }, [onClick, id, isDragging]);

  const clickObserver = useClickObserver(handleBoxClick);

  const handleDrag = (e, data) => {
    setIsDragging(true);
    setPosition({ x: data.x, y: data.y });
  };

  const handleStop = (e, data) => {
    // Just stop dragging and keep the last position; do not hide at edges.
    setIsDragging(false);
    setPosition({ x: data.x, y: data.y });
  };

  return (
    <Draggable
      position={position}
      onStart={clickObserver.onStart}
      onDrag={handleDrag}
      onStop={(e, data) => {
        clickObserver.onStop(e, data);
        handleStop(e, data);
      }}
      bounds="body"
    >
      <div
        ref={containerRef}
        className={`profile-box mini-landscape hide-in-screenshot`}
        style={{
          zIndex: 5,
          bottom: bottom ?? 50,
          cursor: isDragging ? "grabbing" : "grab",
          transition: isDragging ? "none" : "all 0.2s ease",
        }}
      >
        {clips.map((clip, idx) => (
          <img key={idx} src={Utils?.generateThumbnailURL(clip)} />
        ))}
      </div>
    </Draggable>
  );
};
