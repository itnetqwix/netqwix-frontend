import { useEffect, useState, useRef, useCallback } from "react";
import { Link, X, ChevronLeft, ChevronRight } from "react-feather";
import {
  deleteClip,
  myClips,
  reports,
  traineeClips,
} from "../../../../containers/rightSidebar/fileSection.api";
import PhotoSwipeLightbox from "photoswipe/lightbox";
import { useAppDispatch, useAppSelector } from "../../../store";
import { videouploadState } from "../../videoupload/videoupload.slice";
import { Tooltip } from "react-tippy";
import { Utils } from "../../../../utils/utils";
import { authState } from "../../auth/auth.slice";
import Modal from "../../../common/modal";
import { FaDownload, FaTrash } from "react-icons/fa";
import { toast } from "react-toastify";
import ConfirmModal from "./confirmModal";
import { useMediaQuery } from "../../../hook/useMediaQuery";
import { Spinner } from "reactstrap";
import "../../trainer/dashboard/index.scss";
import { commonState, getClipsAsync, getMyClipsAsync } from "../../../common/common.slice";
import { masterState } from "../../master/master.slice";
import { MY_CLIPS_LABEL_LIMIT } from "../../../../utils/constant";
import { AccountType, topNavbarOptions } from "../../../common/constants";
import { authAction } from "../../auth/auth.slice";
import ClipsSkeleton from "../../common/ClipsSkeleton";

const MyClips = ({ activeCenterContainerTab, trainee_id }) => {
  const dispatch = useAppDispatch();

  const { isOpen } = useAppSelector(videouploadState);
  const { clips, myClips, status } = useAppSelector(commonState);

  const [activeTab, setActiveTab] = useState("media");
  const [sortedClips, setSortedClips] = useState([]);
  const [isOpenPlayVideo, setIsOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState("");
  const [selectedClip, setSelectedClip] = useState(null);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(null);
  const [currentClipIndex, setCurrentClipIndex] = useState(null);
  const [reportsData, setReportsData] = useState([]);
  const { sidebarLockerActiveTab, accountType,userInfo } = useAppSelector(authState);
  const { masterData } = useAppSelector(masterState);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [clipPendingDeleteTitle, setClipPendingDeleteTitle] = useState("");
  const [isDeletingClip, setIsDeletingClip] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [actionLocks, setActionLocks] = useState({});
  const pendingNavigateAfterDeleteRef = useRef({ active: false });
  const width500 = useMediaQuery(500);
  const [videoDimensions, setVideoDimensions] = useState({
    maxWidth: width500 ? "100%" : "600px",
    width: width500 ? "100%" : "auto",
    height: width500 ? "70vh" : "75vh",
    maxHeight: width500 ? "600px" : "800px",
    minHeight: width500 ? "400px" : "500px",
  });
  const isMobileScreen= useMediaQuery(600)
  const closeButtonRef = useRef(null);
  const videoPlayerRef = useRef(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  //  const { userInfo } = useAppSelector(authState);

  //  
  useEffect(() => {
    let lightbox = new PhotoSwipeLightbox({
      gallery: "#" + "my-test-gallery",
      children: "a",
      pswpModule: () => import("photoswipe"),
    });
    lightbox.init();

    let lightbox2 = new PhotoSwipeLightbox({
      gallery: "#" + "my-gallery",
      children: "a",
      pswpModule: () => import("photoswipe"),
    });
    lightbox2.init();

    let lightbox3 = new PhotoSwipeLightbox({
      gallery: "#" + "gallery8",
      children: "a",
      pswpModule: () => import("photoswipe"),
    });
    lightbox3.init();
    let lightbox4 = new PhotoSwipeLightbox({
      gallery: "#" + "gallery",
      children: "a",
      pswpModule: () => import("photoswipe"),
    });
    lightbox4.init();

    return () => {
      lightbox.destroy();
      lightbox = null;
      lightbox2.destroy();
      lightbox2 = null;
      lightbox3.destroy();
      lightbox3 = null;
      lightbox4.destroy();
      lightbox4 = null;
    };
  }, []);

  useEffect(() => {
    setActiveTab(sidebarLockerActiveTab);
    if (sidebarLockerActiveTab === "report") {
      var temp = reportsData;
      temp = temp.map((vl, i) => {
        return i === 0 ? { ...vl, show: true } : { ...vl, show: false };
      });
      setReportsData([...temp]);
    }
  }, [sidebarLockerActiveTab]);

  useEffect(() => {
    if (!isOpen && activeCenterContainerTab === "myClips") getMyClips();
  }, [isOpen, activeCenterContainerTab]);

  // Ensure focus stays inside modal when it opens
  useEffect(() => {
    if (isOpenPlayVideo && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpenPlayVideo]);

  // Animate title if it's too long - sliding animation
  useEffect(() => {
    if (!isOpenPlayVideo || !selectedClip) {
      // Clean up animation when modal closes
      const existingStyle = document.getElementById('clip-title-animation');
      if (existingStyle) {
        existingStyle.remove();
      }
      return;
    }

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      const titleElement = document.getElementById('clip-title');
      if (!titleElement) return;

      const container = titleElement.parentElement;
      if (!container) return;

      // Reset any existing animation
      titleElement.style.animation = 'none';
      titleElement.style.transform = 'translateX(0)';
      
      // Force reflow to get accurate measurements
      void titleElement.offsetWidth;

      // Check if title is wider than container
      const titleWidth = titleElement.scrollWidth;
      const containerWidth = container.offsetWidth;

      if (titleWidth > containerWidth) {
        // Title is too long, add sliding animation
        const scrollDistance = titleWidth - containerWidth;
        const scrollDuration = Math.max(3, scrollDistance / 50); // Minimum 3 seconds for scrolling
        const pauseDuration = 3; // 3 seconds pause at the end
        const totalDuration = scrollDuration + pauseDuration + scrollDuration; // Scroll right, pause, scroll back
        
        // Create keyframes animation
        const style = document.createElement('style');
        style.id = 'clip-title-animation';
        style.textContent = `
          @keyframes slideTitle {
            0% {
              transform: translateX(0);
            }
            ${(scrollDuration / totalDuration * 100)}% {
              transform: translateX(-${scrollDistance}px);
            }
            ${((scrollDuration + pauseDuration) / totalDuration * 100)}% {
              transform: translateX(-${scrollDistance}px);
            }
            100% {
              transform: translateX(0);
            }
          }
          #clip-title {
            animation: slideTitle ${totalDuration}s linear infinite;
          }
        `;
        
        // Remove existing animation style if present
        const existingStyle = document.getElementById('clip-title-animation');
        if (existingStyle) {
          existingStyle.remove();
        }
        
        document.head.appendChild(style);
      } else {
        // Title fits, remove animation if exists
        const existingStyle = document.getElementById('clip-title-animation');
        if (existingStyle) {
          existingStyle.remove();
        }
      }
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      const styleToRemove = document.getElementById('clip-title-animation');
      if (styleToRemove) {
        styleToRemove.remove();
      }
    };
  }, [isOpenPlayVideo, selectedClip]);

  // Keyboard navigation for video slider (Esc / ← / →)
  useEffect(() => {
    if (!isOpenPlayVideo) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        handleNextClip();
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handlePreviousClip();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpenPlayVideo, sortedClips, currentGroupIndex, currentClipIndex]);

  const handleVideoLoad = (event) => {
    const video = event.target;
    const aspectRatio = video.videoWidth / video.videoHeight;

    // Set width and height based on aspect ratio and device
    if (aspectRatio > 1) {
      // Landscape video - use more horizontal space
      setVideoDimensions({ 
        width: width500 ? "100%" : "90%", 
        maxWidth: width500 ? "100%" : "800px",
        height: width500 ? "65vh" : "70vh",
        maxHeight: width500 ? "500px" : "700px",
        minHeight: width500 ? "350px" : "450px"
      });
    } else {
      // Portrait/square video - use more vertical space
      setVideoDimensions({
        maxWidth: width500 ? "100%" : "600px",
        width: width500 ? "100%" : "auto",
        height: width500 ? "75vh" : "80vh",
        maxHeight: width500 ? "600px" : "800px",
        minHeight: width500 ? "450px" : "550px"
      });
    }
  };

  const getMyClips = async () => {
    if (trainee_id) {
      dispatch(getClipsAsync({ trainee_id }));
    } else {
      dispatch(getMyClipsAsync());
    }
  };

  const handleDelete = async (id) => {
    if (!id || isDeletingClip || isActionLocked("delete-confirm")) return;
    lockActionForMs("delete-confirm", 1500);

    const nextPos = findNextClipPosition();
    const prevPos = findPreviousClipPosition();
    const targetIdAfterDelete =
      nextPos?.clip?._id ?? prevPos?.clip?._id ?? null;
    const optimisticNextPos = getClipPositionAfterDelete(id);

    setIsDeletingClip(true);
    try {
      const res = await deleteClip({ id });
      if (res?.success) {
        toast.success(res?.message || "Clip deleted.");
        setIsConfirmModalOpen(false);
        setSelectedId(null);
        setClipPendingDeleteTitle("");
        if (optimisticNextPos?.clip) {
          openClipInModal(
            optimisticNextPos.groupIndex,
            optimisticNextPos.clipIndex,
            optimisticNextPos.clip
          );
        } else {
          resetVideoViewer();
        }
        await getMyClips();
        pendingNavigateAfterDeleteRef.current = {
          active: true,
          targetId: targetIdAfterDelete,
        };
      } else {
        toast.error(res?.message || "Could not delete this clip.");
      }
    } catch {
      toast.error("Something went wrong while deleting. Please try again.");
    } finally {
      setIsDeletingClip(false);
    }
  };

  const handleCloseModal = () => {
    if (isDeletingClip) return;
    setIsConfirmModalOpen(false);
    setSelectedId(null);
    setClipPendingDeleteTitle("");
  };

  const openClipInModal = useCallback((groupIdx, clipIdx, clip) => {
    setIsVideoLoading(false); // Don't show loading initially, let poster show
    setCurrentGroupIndex(groupIdx);
    setCurrentClipIndex(clipIdx);
    setSelectedVideo(Utils?.generateVideoURL(clip));
    setSelectedClip(clip);
    setIsOpen(true);
  }, []);

  const resetVideoViewer = useCallback(() => {
    setIsOpen(false);
    setSelectedClip(null);
    setSelectedVideo("");
    setCurrentGroupIndex(null);
    setCurrentClipIndex(null);
    setIsVideoLoading(false);
  }, []);

  const handleDownloadClip = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedClip || downloadBusy) return;

    const url = Utils?.generateVideoURL(selectedClip);
    const filename =
      (selectedClip?.title &&
        `${String(selectedClip.title).replace(/[^\w\s.-]/g, "_").slice(0, 120)}.mp4`) ||
      `clip-${selectedClip?._id || "download"}.mp4`;

    setDownloadBusy(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Bad response");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);
      toast.success("Download started.");
    } catch {
      try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        toast.info(
          "If the file did not save, check your browser or the new tab."
        );
      } catch {
        toast.error("Could not download this clip. Try again later.");
      }
    } finally {
      setDownloadBusy(false);
    }
  };

  const findNextClipPosition = () => {
    if (currentGroupIndex === null || currentClipIndex === null) return null;

    let g = currentGroupIndex;
    let c = currentClipIndex + 1;

    while (g < sortedClips.length) {
      const group = sortedClips[g];
      const clipsInGroup = group?.clips || [];
      if (c < clipsInGroup.length) {
        return { groupIndex: g, clipIndex: c, clip: clipsInGroup[c] };
      }
      g += 1;
      c = 0;
    }
    return null;
  };

  const findPreviousClipPosition = () => {
    if (currentGroupIndex === null || currentClipIndex === null) return null;

    let g = currentGroupIndex;
    let c = currentClipIndex - 1;

    while (g >= 0) {
      const group = sortedClips[g];
      const clipsInGroup = group?.clips || [];
      if (c >= 0 && c < clipsInGroup.length) {
        return { groupIndex: g, clipIndex: c, clip: clipsInGroup[c] };
      }
      g -= 1;
      if (g >= 0) {
        const prevGroup = sortedClips[g];
        const prevClips = prevGroup?.clips || [];
        c = prevClips.length - 1;
      }
    }
    return null;
  };

  const lockActionForMs = useCallback((key, ms = 900) => {
    if (!key) return;
    setActionLocks((prev) => ({ ...prev, [key]: true }));
    window.setTimeout(() => {
      setActionLocks((prev) => ({ ...prev, [key]: false }));
    }, ms);
  }, []);

  const isActionLocked = useCallback(
    (key) => !!actionLocks[key],
    [actionLocks]
  );

  const getClipPositionAfterDelete = useCallback(
    (deletedId) => {
      if (!deletedId || currentGroupIndex == null || currentClipIndex == null) {
        return null;
      }
      const next = [];
      for (let g = 0; g < sortedClips.length; g++) {
        const group = sortedClips[g];
        const clipsInGroup = (group?.clips || []).filter(
          (clip) => clip?._id !== deletedId
        );
        if (clipsInGroup.length) {
          next.push({ ...group, clips: clipsInGroup });
        }
      }
      if (!next.length) return null;

      let g = Math.min(currentGroupIndex, next.length - 1);
      let c = currentClipIndex;
      const groupLen = next[g]?.clips?.length || 0;
      if (groupLen === 0) return null;
      if (c >= groupLen) c = groupLen - 1;
      if (c < 0) c = 0;

      return {
        groupIndex: g,
        clipIndex: c,
        clip: next[g].clips[c],
      };
    },
    [currentGroupIndex, currentClipIndex, sortedClips]
  );

  const handleNextClip = () => {
    const next = findNextClipPosition();
    if (!next) return;
    // Pause and reset current video if playing
    if (videoPlayerRef.current) {
      videoPlayerRef.current.pause();
      videoPlayerRef.current.currentTime = 0;
    }
    // Show loading state to display thumbnail
    setIsVideoLoading(true);
    setCurrentGroupIndex(next.groupIndex);
    setCurrentClipIndex(next.clipIndex);
    setSelectedVideo(Utils?.generateVideoURL(next.clip));
    setSelectedClip(next.clip);
  };

  const handlePreviousClip = () => {
    const prev = findPreviousClipPosition();
    if (!prev) return;
    // Pause and reset current video if playing
    if (videoPlayerRef.current) {
      videoPlayerRef.current.pause();
      videoPlayerRef.current.currentTime = 0;
    }
    // Show loading state to display thumbnail
    setIsVideoLoading(true);
    setCurrentGroupIndex(prev.groupIndex);
    setCurrentClipIndex(prev.clipIndex);
    setSelectedVideo(Utils?.generateVideoURL(prev.clip));
    setSelectedClip(prev.clip);
  };

  useEffect(() => {
    if(trainee_id){
      if (clips?.length && masterData?.category?.length) {
        //NOTE -  Function to sort clips based on the desired order
        const desiredOrder = masterData?.category?.map((data) => data);
  
        const sortClips = (clips) => {
          const clipsCopy = clips.slice();
          return clipsCopy.sort((a, b) => {
            return desiredOrder.indexOf(a._id) - desiredOrder.indexOf(b._id);
          });
        };
        //NOTE -  call the SortClips funtion 
        const sortedClips = sortClips(clips);
         
        setSortedClips(sortedClips);
      }
    }else{
      if (myClips?.length && masterData?.category?.length) {
        //NOTE -  Function to sort myClips based on the desired order
        const desiredOrder = masterData?.category?.map((data) => data);
  
        const sortClips = (myClips) => {
          const clipsCopy = myClips.slice();
          return clipsCopy.sort((a, b) => {
            return desiredOrder.indexOf(a._id) - desiredOrder.indexOf(b._id);
          });
        };
        //NOTE -  call the SortClips funtion 
        const sortedClips = sortClips(myClips);
         
        setSortedClips(sortedClips);
      }
    }
    
  }, [clips,trainee_id,myClips]);

  useEffect(() => {
    const pending = pendingNavigateAfterDeleteRef.current;
    if (!pending?.active) return;
    pendingNavigateAfterDeleteRef.current = { active: false };

    const { targetId } = pending;
    if (!targetId) {
      resetVideoViewer();
      return;
    }

    for (let g = 0; g < sortedClips.length; g++) {
      const clipsInGroup = sortedClips[g]?.clips || [];
      for (let c = 0; c < clipsInGroup.length; c++) {
        if (clipsInGroup[c]?._id === targetId) {
          openClipInModal(g, c, clipsInGroup[c]);
          return;
        }
      }
    }
    resetVideoViewer();
  }, [sortedClips, openClipInModal, resetVideoViewer]);

  return (
    <>
      <div className="media-gallery portfolio-section grid-portfolio">
        <div style={{ marginBottom: "15px", textAlign: "center" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "4px" }}>
            {trainee_id ? "Student Clips" : "My Clips"}
          </h2>
          <p style={{ fontSize: "13px", color: "#666", margin: 0 }}>
            {trainee_id ? "View clips from this student." : "Browse and manage your uploaded clips."}
          </p>
        </div>
        {status === "pending" ? (
          <ClipsSkeleton />
        ) : (trainee_id ? clips?.length : myClips?.length) ? (
          sortedClips?.map((cl, ind) => (
            <div
              className={`collapse-block ${!cl?.show ? "" : "open"}`}
              key={`clip-${cl?._id ?? ind}`}
            >
     {accountType !== AccountType.TRAINER && <h5 className="block-title" onClick={() => { }}>
                {cl?._id}
                <label className="badge badge-primary sm ml-2">
                  {cl?.clips?.length}
                </label>
              </h5>}
              {/*  NORMAL  STRUCTURE END  */}
              <div className={`block-content ${!cl?.show ? "d-none" : ""}`}>
                <div className="locker-clips-grid">
                  {cl?.clips?.map((clp, index) => (
                    <div
                      key={index}
                      className="locker-clip-item video-container"
                    >
                      <div
                        style={{ margin: "auto", textAlign: "center", width: "100%" }}
                        className="hover-video"
                      >
                        <Tooltip
                          title={clp?.title}
                          position="bottom"
                          trigger="mouseenter"
                        >
                          <div style={{ position: "relative", width: "100%" }}>
                            <video
                              className="locker-clip-preview"
                              poster={Utils?.generateThumbnailURL(clp)}
                              preload="none"
                              style={{
                                position: "relative",
                                cursor: "pointer"
                              }}
                              onClick={() => {
                                openClipInModal(ind, index, clp);
                              }}
                            />
                          </div>
                        </Tooltip>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        ) : (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: "40px",
              }}
            >
              <h5 className="block-title"> No Data Found</h5>
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={isOpenPlayVideo}
        element={
          <>
            <div className="d-flex flex-column align-items-center justify-content-center h-100" style={{ padding: "20px", minHeight: "100vh", maxHeight: "100vh", overflow: "auto" }}>
              <div
                className="position-relative"
                style={{ 
                  borderRadius: 8, 
                  maxWidth: "100%",
                  width: "100%",
                  backgroundColor: "#1a1a1a",
                  padding: "20px",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center"
                }}
              >
                {/* Close button */}
                <div className="media-body text-right" style={{ position: "absolute", top: "10px", right: "10px", zIndex: 10 }}>
                  <button
                    ref={closeButtonRef}
                    type="button"
                    className="icon-btn btn-sm btn-outline-light close-apps pointer"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close video"
                    style={{
                      backgroundColor: "rgba(0,0,0,0.5)",
                      borderRadius: "50%",
                      padding: "8px"
                    }}
                  >
                    <X />
                  </button>
                </div>

                {/* Title at top center with sliding animation if too long */}
                {selectedClip && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "20px",
                      paddingTop: "10px",
                      width: "100%",
                      maxWidth: "90%",
                      overflow: "hidden",
                      margin: "0 auto 20px auto"
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        maxWidth: "100%",
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    }}
                  >
                    <h4
                        id="clip-title"
                      style={{
                        margin: 0,
                        fontSize: "18px",
                        fontWeight: 600,
                        color: "#fff",
                        textAlign: "center",
                        whiteSpace: "nowrap",
                          display: "inline-block"
                      }}
                    >
                      {selectedClip.title}
                    </h4>
                    </div>
                  </div>
                )}

                {/* Video with navigation buttons */}
                <div className="d-flex align-items-center justify-content-center" style={{ marginBottom: "20px", position: "relative", width: "100%" }}>
                  {/* Previous button */}
                  <button
                    type="button"
                    className="icon-btn btn-sm btn-outline-light mr-2"
                    onClick={() => {
                      if (isActionLocked("prev-clip")) return;
                      lockActionForMs("prev-clip", 350);
                      handlePreviousClip();
                    }}
                    disabled={!findPreviousClipPosition()}
                    aria-label="Previous clip"
                    style={{
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(255, 255, 255, 0.9)",
                      border: "2px solid rgba(255, 255, 255, 0.3)",
                      padding: "12px",
                      width: "48px",
                      height: "48px",
                      opacity: !findPreviousClipPosition() ? 0.4 : 1,
                      cursor: !findPreviousClipPosition() ? "not-allowed" : "pointer",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
                      transition: "all 0.3s ease",
                      backdropFilter: "blur(10px)",
                      zIndex: 10,
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      if (findPreviousClipPosition()) {
                        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 1)";
                        e.currentTarget.style.transform = "scale(1.15)";
                        e.currentTarget.style.boxShadow = "0 6px 16px rgba(0, 0, 0, 0.5)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (findPreviousClipPosition()) {
                        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
                        e.currentTarget.style.transform = "scale(1)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.4)";
                      }
                    }}
                  >
                    <ChevronLeft size={24} color="#000" strokeWidth={2.5} />
                  </button>

                  <div 
                    style={{ 
                      position: "relative", 
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      maxWidth: width500 ? "100%" : "90%",
                      width: width500 ? "100%" : "auto",
                      minWidth: width500 ? "100%" : "450px",
                      height: width500 ? "70vh" : "75vh",
                      minHeight: width500 ? "450px" : "550px",
                      maxHeight: width500 ? "600px" : "800px",
                      overflow: "hidden",
                      borderRadius: "8px",
                      backgroundColor: "#000",
                      margin: "0 auto"
                    }}
                  >
                    {/* Show thumbnail/poster first while video loads */}
                    {isVideoLoading && selectedClip && (
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "#000",
                          zIndex: 5,
                          borderRadius: "8px"
                        }}
                      >
                        <img
                          src={Utils?.generateThumbnailURL(selectedClip)}
                          alt="Video thumbnail"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            opacity: 0.6,
                            borderRadius: "8px"
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "12px",
                            zIndex: 6
                          }}
                        >
                          <div
                            className="spinner-border text-white"
                            role="status"
                            style={{
                              width: "3rem",
                              height: "3rem",
                              borderWidth: "0.3em",
                              borderColor: "rgba(255, 255, 255, 0.3)",
                              borderRightColor: "#fff"
                            }}
                          >
                            <span className="sr-only">Loading...</span>
                          </div>
                          <div style={{ color: "#fff", fontSize: "14px", fontWeight: 500, textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>
                            Loading video...
                          </div>
                        </div>
                      </div>
                    )}
                    <video
                      ref={videoPlayerRef}
                      key={selectedVideo}
                      style={{
                        width: "100%",
                        height: "100%",
                        maxWidth: "100%",
                        maxHeight: "100%",
                        objectFit: "contain",
                        opacity: isVideoLoading ? 0 : 1,
                        transition: "opacity 0.2s ease",
                        position: "relative",
                        zIndex: 1,
                        display: "block"
                      }}
                      autoPlay={false}
                    controls
                      playsInline
                      preload="metadata"
                      poster={selectedClip ? Utils?.generateThumbnailURL(selectedClip) : undefined}
                      onLoadedMetadata={(e) => {
                        handleVideoLoad(e);
                        // Metadata loaded - video poster/thumbnail is ready
                        setIsVideoLoading(false);
                      }}
                      onLoadedData={() => {
                        // Video data loaded - ready to play
                        setIsVideoLoading(false);
                      }}
                      onCanPlay={() => {
                        // Video can start playing
                        setIsVideoLoading(false);
                      }}
                      onWaiting={() => {
                        // Only show loading spinner if video is actually playing and buffering
                        if (videoPlayerRef.current && !videoPlayerRef.current.paused) {
                          setIsVideoLoading(true);
                        }
                      }}
                      onPlaying={() => {
                        // Video started playing - hide loading
                        setIsVideoLoading(false);
                      }}
                      onError={() => {
                        setIsVideoLoading(false);
                      }}
                  >
                    <source src={selectedVideo} type="video/mp4" />
                  </video>
                  </div>

                  {/* Next button */}
                  <button
                    type="button"
                    className="icon-btn btn-sm btn-outline-light ml-2"
                    onClick={() => {
                      if (isActionLocked("next-clip")) return;
                      lockActionForMs("next-clip", 350);
                      handleNextClip();
                    }}
                    disabled={!findNextClipPosition()}
                    aria-label="Next clip"
                    style={{
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(255, 255, 255, 0.9)",
                      border: "2px solid rgba(255, 255, 255, 0.3)",
                      padding: "12px",
                      width: "48px",
                      height: "48px",
                      opacity: !findNextClipPosition() ? 0.4 : 1,
                      cursor: !findNextClipPosition() ? "not-allowed" : "pointer",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
                      transition: "all 0.3s ease",
                      backdropFilter: "blur(10px)",
                      zIndex: 10,
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      if (findNextClipPosition()) {
                        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 1)";
                        e.currentTarget.style.transform = "scale(1.15)";
                        e.currentTarget.style.boxShadow = "0 6px 16px rgba(0, 0, 0, 0.5)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (findNextClipPosition()) {
                        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
                        e.currentTarget.style.transform = "scale(1)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.4)";
                      }
                    }}
                  >
                    <ChevronRight size={24} color="#000" strokeWidth={2.5} />
                  </button>
                </div>

                {/* Action buttons at bottom */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "12px",
                    paddingTop: "15px",
                    borderTop: "1px solid rgba(255,255,255,0.1)"
                  }}
                >
                  {/* Delete and Download buttons - shown for all users (students and trainers) */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "12px",
                        width: "100%",
                        maxWidth: "400px"
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isActionLocked("delete-open")) return;
                          lockActionForMs("delete-open");
                          setClipPendingDeleteTitle(selectedClip?.title || "");
                          setSelectedId(selectedClip?._id);
                          setIsConfirmModalOpen(true);
                        }}
                        disabled={downloadBusy || isDeletingClip || isActionLocked("delete-open")}
                        aria-busy={isDeletingClip}
                        style={{
                          border: "none",
                        background: "#ff0000",
                          color: "#fff",
                          borderRadius: "6px",
                        padding: "12px 20px",
                          display: "flex",
                          alignItems: "center",
                        justifyContent: "center",
                          gap: "8px",
                          fontSize: "14px",
                          fontWeight: 500,
                          cursor: downloadBusy || isDeletingClip ? "not-allowed" : "pointer",
                          opacity: downloadBusy || isDeletingClip ? 0.65 : 1,
                          transition: "all 0.3s ease",
                        flex: "1",
                        height: "44px"
                        }}
                      onMouseEnter={(e) => {
                        if (!downloadBusy && !isDeletingClip) e.target.style.background = "#cc0000";
                      }}
                      onMouseLeave={(e) => {
                        if (!downloadBusy && !isDeletingClip) e.target.style.background = "#ff0000";
                      }}
                      >
                        <FaTrash size={14} />
                        <span>Delete</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadClip}
                        disabled={downloadBusy || isDeletingClip}
                        aria-busy={downloadBusy}
                        style={{
                          background: "#007bff",
                          color: "#fff",
                          borderRadius: "6px",
                          border: "none",
                        padding: "12px 20px",
                          display: "flex",
                          alignItems: "center",
                        justifyContent: "center",
                          gap: "8px",
                          fontSize: "14px",
                          fontWeight: 500,
                          cursor: downloadBusy || isDeletingClip ? "not-allowed" : "pointer",
                          opacity: downloadBusy || isDeletingClip ? 0.65 : 1,
                          transition: "all 0.3s ease",
                        flex: "1",
                        height: "44px"
                        }}
                        onMouseEnter={(e) => {
                          if (!downloadBusy && !isDeletingClip) e.target.style.background = "#0056b3";
                        }}
                        onMouseLeave={(e) => {
                          if (!downloadBusy && !isDeletingClip) e.target.style.background = "#007bff";
                        }}
                      >
                        {downloadBusy ? (
                          <Spinner size="sm" color="light" />
                        ) : (
                          <FaDownload size={14} />
                        )}
                        <span>{downloadBusy ? "Downloading…" : "Download"}</span>
                      </button>
                    </div>
                  
                  {/* Book An Instant Lesson Now button - only for trainees (not trainers) */}
                  {accountType !== AccountType.TRAINER && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isActionLocked("book-lesson")) return;
                      lockActionForMs("book-lesson", 1200);
                      setIsOpen(false);
                      dispatch(authAction?.setTopNavbarActiveTab(topNavbarOptions?.BOOK_LESSON));
                    }}
                    disabled={isActionLocked("book-lesson")}
                    style={{
                        border: "2px solid #28a745",
                        background: "#28a745",
                        color: "#000000",
                      borderRadius: "6px",
                      padding: "12px 24px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "15px",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                        boxShadow: "0 2px 8px rgba(40, 167, 69, 0.4)",
                      width: "100%",
                      maxWidth: "400px",
                      justifyContent: "center"
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#218838";
                        e.currentTarget.style.borderColor = "#218838";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(40, 167, 69, 0.6)";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = "#28a745";
                        e.currentTarget.style.borderColor = "#28a745";
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(40, 167, 69, 0.4)";
                    }}
                  >
                    <span>Book An Instant Lesson Now!</span>
                  </button>
                  )}
                </div>
              </div>
            </div>
          </>
        }
      />

      {isConfirmModalOpen && (
        <ConfirmModal
          isModelOpen={isConfirmModalOpen}
          selectedId={selectedId}
          deleteFunc={handleDelete}
          closeModal={handleCloseModal}
          clipTitle={clipPendingDeleteTitle}
          isDeleting={isDeletingClip}
        />
      )}
    </>
  );
};

export default MyClips;
