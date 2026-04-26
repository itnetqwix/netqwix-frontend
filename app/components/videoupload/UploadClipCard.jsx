
import React, { useEffect, useState, useRef } from "react";
import { flushSync } from "react-dom";
import { videouploadState, videouploadAction } from "./videoupload.slice";
import { useAppSelector, useAppDispatch } from "../../store";
import Modal from "../../common/modal";
import { Button, Form, FormGroup, Label, Input } from "reactstrap";
import { getS3SignUrl } from "./videoupload.api";
import { AccountType, LIST_OF_ACCOUNT_TYPE } from "../../common/constants";
import { getMasterData } from "../master/master.api";
import axios from "axios";
import { X, Upload, Video, FileText, Users, Mail, CheckCircle, AlertCircle, Loader } from "react-feather";
import { toast } from "react-toastify";
import { getClipsAsync, getMyClipsAsync } from "../../common/common.slice";
import { generateThumbnailURL } from "../common/common.api";
import "./UploadClipCard.scss";
import dynamic from 'next/dynamic';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import UAParser from 'ua-parser-js';
import { useSelector } from "react-redux";
import FriendsPopup from "../pop-ups/FriendsPopUp";
import EmailsPopup from "../pop-ups/EmailPopUp";

const OS = {
  android: 'android',
  mac: "Mac OS",
  ios: 'iOS',
  windows: "Windows",
}

const BROWSER = {
  chrome: 'Chrome',
  safari: "Safari",
  MobileSafari: "Mobile Safari"
}

const parser = new UAParser();

const shareWithConstants = {
  myClips: "My Clips",
  myFriends: "Friends",
  newUsers: "New Users"
}

const UploadClipCard = (props) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [titles, setTitles] = useState([]);
  const [category, setCategory] = useState("");
  const [categoryList, setCategoryList] = useState([]);
  const ref = useRef();
  const dispatch = useAppDispatch();
  const [progress, setProgress] = useState([]);
  const { isOpen } = useAppSelector(videouploadState);
  const userInfo = useSelector((state) => state.auth.userInfo)
  const [isUploading, setIsUploading] = useState(false)
  const [thumbnails, setThumbnails] = useState([]);
  const videoRefs = useRef([]);
  const canvasRefs = useRef([]);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [loading, setLoading] = useState([]);
  const ffmpegRef = useRef(null);
  const selectedFilesSectionRef = useRef(null);
  /** Latest file queue for async thumbnail + server fallback (avoids stale `videos[ ]` closure). */
  const fileQueueRef = useRef([]);
  const [deviceInfo, setDeviceInfo] = useState({});
  const [shareWith, setShareWith] = useState(shareWithConstants.myClips)
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [selectedFriendProfiles, setSelectedFriendProfiles] = useState([]);
  const [selectedEmails, setSelectedEmails] = useState([]);
  const { isFromCommunity, closeResetsFileQueue = false } = props;
  const prevIsOpenRef = useRef(isOpen);
  useEffect(() => {
    const result = parser.getResult();
    setDeviceInfo(result);
  }, []);

  useEffect(() => {
    fileQueueRef.current = selectedFiles;
  }, [selectedFiles]);

  useEffect(()=>{
    if(isFromCommunity){
      setShareWith(shareWithConstants.myFriends)
      setSelectedFriends([isFromCommunity])
    }
  },[isFromCommunity])

  useEffect(() => {
    const loadFFmpeg = async () => {
      try {
        const ffmpeg = new FFmpeg();
        ffmpegRef.current = ffmpeg;
        const coreURL = '/ffmpeg-core.js';
        const wasmURL = '/ffmpeg-core.wasm';
        await ffmpeg.load({ coreURL, wasmURL });
        setFfmpegLoaded(true);
      } catch (error) {
        console.error('Error loading FFmpeg:', error);
      }
    };
    loadFFmpeg();
  }, []);

  const handleTitleChange = (index, value) => {
    setTitles(prev => {
      const newTitles = [...prev];
      newTitles[index] = value;
      return newTitles;
    });
  };

  const generateThumbnail = async (index) => {
    console.log("[UploadClipCard] generateThumbnail:start", { index });
    setLoading(prev => {
      const newLoading = [...prev];
      newLoading[index] = true;
      return newLoading;
    });

    try {
      const video = videoRefs.current[index];
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      // Wait for metadata with timeout + error guard so unsupported codecs
      // (e.g. HEVC .mov on Chrome) don't hang the promise indefinitely.
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('loadedmetadata timeout')), 6000);
        const done = () => { clearTimeout(timer); resolve(); };
        video.addEventListener('loadedmetadata', done, { once: true });
        video.addEventListener('error', () => { clearTimeout(timer); reject(new Error(`video error: ${video.error?.code}`)); }, { once: true });
        if (video.readyState >= 1) done();
      });

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const seekTime = Math.min(1, video.duration * 0.25);
      video.currentTime = seekTime;

      // Wait for seek with timeout — some formats never fire onseeked off-DOM.
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('onseeked timeout')), 5000);
        video.addEventListener('seeked', () => { clearTimeout(timer); resolve(); }, { once: true });
        video.addEventListener('error', () => { clearTimeout(timer); reject(new Error(`seek error: ${video.error?.code}`)); }, { once: true });
      });

      await new Promise(resolve => setTimeout(resolve, 200));
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const blob = await fetch(dataUrl).then(res => res.blob());

      setThumbnails(prev => {
        const newThumbnails = [...prev];
        newThumbnails[index] = {
          thumbnailFile: blob,
          dataUrl: dataUrl,
          fileType: blob.type
        };
        return newThumbnails;
      });
      console.log("[UploadClipCard] generateThumbnail:success", { index });
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      // Fallback: try to generate thumbnail on server if client-side generation fails
      try {
        const thumbnailUrl = await generateThumbnailURL(fileQueueRef.current[index]);
        if (thumbnailUrl) {
          const response = await fetch(thumbnailUrl);
          const blob = await response.blob();
          setThumbnails(prev => {
            const newThumbnails = [...prev];
            newThumbnails[index] = {
              thumbnailFile: blob,
              dataUrl: thumbnailUrl,
              fileType: blob.type
            };
            return newThumbnails;
          });
          console.log("[UploadClipCard] generateThumbnail:server-fallback-success", { index });
        }
      } catch (serverError) {
        console.error('Error generating thumbnail on server:', serverError);
      }
    } finally {
      setLoading(prev => {
        const newLoading = [...prev];
        newLoading[index] = false;
        return newLoading;
      });
    }
  };

  const handleFileChange = async (e) => {
    if (e.target.files.length) {
      console.log("[UploadClipCard] handleFileChange:selected", {
        totalSelected: e.target.files.length,
      });
      const newFiles = Array.from(e.target.files);
      const maxSizeMB = 50;
      const invalidFiles = newFiles.filter(file => (file.size / 1024 / 1024) > maxSizeMB);
      
      if (invalidFiles.length > 0) {
        console.warn("[UploadClipCard] handleFileChange:invalid-files", {
          invalidFiles: invalidFiles.map((f) => ({ name: f.name, size: f.size })),
        });
        const fileNames = invalidFiles.map(f => f.name).join(", ");
        const fileSizes = invalidFiles.map(f => `${(f.size / 1024 / 1024).toFixed(2)} MB`).join(", ");
        toast.error(
          `The following video${invalidFiles.length > 1 ? 's' : ''} exceed the maximum file size of ${maxSizeMB}MB and cannot be uploaded:\n\n${fileNames}\n\nFile sizes: ${fileSizes}\n\nPlease select smaller video files.`,
          {
            autoClose: 8000,
            style: { whiteSpace: 'pre-line' }
          }
        );
        e.target.value = "";
        return;
      }

      const validFiles = newFiles.filter(file => (file.size / 1024 / 1024) <= maxSizeMB);
      const acceptedMimePrefix = "video/";
      const acceptedExtensions = [".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv"];
      const unsupportedFiles = validFiles.filter((file) => {
        const hasVideoMime = String(file?.type || "").startsWith(acceptedMimePrefix);
        const lowerName = String(file?.name || "").toLowerCase();
        const hasAcceptedExtension = acceptedExtensions.some((ext) => lowerName.endsWith(ext));
        return !hasVideoMime && !hasAcceptedExtension;
      });

      if (unsupportedFiles.length > 0) {
        toast.error(
          `Unsupported file format: ${unsupportedFiles.map((f) => f.name).join(", ")}. Please upload video files only.`
        );
        e.target.value = "";
        return;
      }
      console.log("[UploadClipCard] handleFileChange:valid-files", {
        validCount: validFiles.length,
        fileNames: validFiles.map((f) => f.name),
      });

      // Commit file list so baseIndex matches slot indices (React 18 may defer updates).
      let baseIndex = 0;
      flushSync(() => {
        setSelectedFiles((prevFiles) => {
          baseIndex = prevFiles.length;
          return [...prevFiles, ...validFiles];
        });
      });
      validFiles.forEach((file, offset) => {
        const videoIndex = baseIndex + offset;
        const video = document.createElement("video");
        video.playsInline = true;
        video.muted = true;
        video.preload = "metadata";
        const videoUrl = URL.createObjectURL(file);
        video.src = videoUrl;
        videoRefs.current[videoIndex] = video;
      });
      for (let o = 0; o < validFiles.length; o++) {
        setTimeout(() => generateThumbnail(baseIndex + o), 100);
      }
      setThumbnails((prev) => [
        ...prev,
        ...validFiles.map(() => null),
      ]);
      setTitles((prev) => [
        ...prev,
        ...validFiles.map(() => ""),
      ]);
      setLoading((prev) => [
        ...prev,
        ...validFiles.map(() => true),
      ]);
      setProgress((prev) => [
        ...prev,
        ...validFiles.map(() => 0),
      ]);
    }
    // Allow selecting the same file again in a later attempt.
    e.target.value = "";
  };

  const handleUpload = async () => {
    console.log("[UploadClipCard] handleUpload:clicked", {
      shareWith,
      selectedFiles: selectedFiles.length,
      selectedFriends: selectedFriends.length,
      selectedEmails: selectedEmails.length,
      category,
    });
    if (shareWith === shareWithConstants.newUsers && selectedEmails.length <= 0) {
      toast.error("Please Add Emails to Share Clips With.");
      return;
    } else if (shareWith === shareWithConstants.myFriends && selectedFriends.length <= 0) {
      toast.error("Please Add Friends to Share Clips With.");
      return;
    }

    if (selectedFiles.length === 0) {
      toast.error("Please select at least one video file.");
      return;
    }

    const normalizedCategory = String(category || userInfo?.category || "").trim();
    if (!normalizedCategory) {
      toast.error("Please choose a category before uploading.");
      return;
    }

    for (let i = 0; i < selectedFiles.length; i++) {
      if (!thumbnails[i]?.fileType) {
        toast.error(`Please wait for thumbnail to generate for video ${i + 1}`);
        return;
      }
      if (!titles[i] || titles[i].trim() === "") {
        toast.error(`Please enter a title for video ${i + 1}`);
        return;
      }
    }

    setIsUploading(true);
    
    try {
      const bulkPayload = {
        clips: selectedFiles.map((file, index) => ({
          filename: file?.name,
          fileType: file?.type,
          thumbnail: thumbnails[index]?.fileType,
          title: titles[index],
          category: normalizedCategory,
        })),
        shareOptions: {
          type: shareWith,
          friends: shareWith === shareWithConstants.myFriends ? selectedFriends : undefined,
          emails: shareWith === shareWithConstants.newUsers ? selectedEmails : undefined
        }
      };
      console.log("[UploadClipCard] handleUpload:bulkPayload", bulkPayload);

      const data = await getS3SignUrl(bulkPayload);
      console.log("[UploadClipCard] handleUpload:getS3SignUrl:response", data);
      if (!data?.results || !Array.isArray(data.results)) {
        const fallbackMsg =
          data?.error || data?.message || "Failed to initialize upload. Please try again.";
        throw new Error(fallbackMsg);
      }
      if (data?.results) {
        const uploadPromises = data.results.map(async (urlData, index) => {
          try {
            console.log("[UploadClipCard] pushToS3:start", {
              index,
              fileName: selectedFiles[index]?.name,
            });
            await pushToS3(urlData.url, selectedFiles[index], index);
            await pushToS3(urlData.thumbnailURL, thumbnails[index].thumbnailFile, index);
            console.log("[UploadClipCard] pushToS3:success", { index });
            return true;
          } catch (error) {
            console.error(`Error uploading file ${index}:`, error);
            return false;
          }
        });

        const results = await Promise.all(uploadPromises);
        if (results.every(r => r)) {
          /**
           * NOTE:
           * - We explicitly refresh the clips lists in Redux after a successful upload
           *   so that the "My Uploads / Uploaded Videos" (MyClips) section updates
           *   automatically without requiring a full page refresh.
           * - For community uploads we refresh the trainee-specific clips via
           *   `getClipsAsync({ trainee_id })`.
           * - For normal uploads we refresh the current user's own clips via
           *   `getMyClipsAsync()`, which updates the `myClips` slice used by
           *   the MyClips component.
           * - This avoids duplicates because we always re-fetch the full list
           *   from the backend instead of manually appending to state.
           */
          toast.success("All clips uploaded successfully!", {
            autoClose: false
          });
          resetForm();

          if (isFromCommunity) {
            // Refresh the specific trainee's clips when uploading from community context
            dispatch(getClipsAsync({ trainee_id: isFromCommunity }));
          } else {
            // Refresh the current user's own clips used in "My Uploads / Uploaded Videos"
            dispatch(getMyClipsAsync());
          }
        } else {
          toast.error("Some clips failed to upload.",{
            autoClose:false
          });
        }
      }
    } catch (error) {
      console.error("Error during bulk upload:", error);
      const apiError =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "Error during upload";
      toast.error(apiError);
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setSelectedFiles([]);
    setThumbnails([]);
    setTitles([]);
    setLoading([]);
    setProgress([]);
    setSelectedFriends([]);
    setSelectedFriendProfiles([]);
    setSelectedEmails([]);
  };

  async function pushToS3(presignedUrl, file, index) {
    try {
      const myHeaders = {
        "Content-Type": file.type,
        "Content-Disposition": "inline",
      };

      const response = await axios.put(presignedUrl, file, {
        headers: myHeaders,
        onUploadProgress: (progressEvent) => {
          const { loaded, total } = progressEvent;
          const percentCompleted = (loaded / total) * 100;
          setProgress(prev => {
            const newProgress = [...prev];
            newProgress[index] = Math.trunc(percentCompleted === 100 ? 0 : percentCompleted);
            return newProgress;
          });
        },
      });
      return response;
    } catch (error) {
      console.error("Error uploading to S3:", error);
      throw error;
    }
  }


  const getCategoryData = async () => {
    try {
      var res = await getMasterData();
      
      // Check if response and data exist
      if (res?.data?.data?.[0]?.category) {
        const mappedCategories = res.data.data[0].category.map((val, ind) => {
            return {
              id: ind,
              label: val,
              value: val,
            };
          });
        setCategoryList(mappedCategories);

        // Preselect trainer category only if it exists in master categories
        // and the user has not selected a category yet.
        if (!category && userInfo?.category) {
          const trainerCategory = String(userInfo.category).trim();
          const existsInMaster = mappedCategories.some((c) => c.value === trainerCategory);
          if (trainerCategory && existsInMaster) {
            setCategory(trainerCategory);
          }
        }
      } else {
        console.warn('[UploadClipCard] No category data found in response');
        setCategoryList([]);
      }
    } catch (error) {
      console.error('[UploadClipCard] Error fetching category data:', error);
      
      // Show user-friendly error message
      if (error.isNetworkError || error.message?.includes('Network Error')) {
        toast.error('Unable to load categories. Please check your internet connection.');
      } else if (error.response?.status === 401) {
        toast.error('Session expired. Please log in again.');
      } else {
        toast.error('Failed to load categories. Please try again later.');
      }
      
      // Set empty category list to prevent further errors
      setCategoryList([]);
    }
  };

  useEffect(() => {
    getCategoryData();
  }, []);

  useEffect(() => {
    if (!closeResetsFileQueue) {
      prevIsOpenRef.current = isOpen;
      return;
    }
    const wasOpen = prevIsOpenRef.current;
    const isNowClosed = wasOpen && !isOpen;

    if (isNowClosed) {
      setTitles([""]);
      setCategory("");
      resetForm();
    }

    prevIsOpenRef.current = isOpen;
  }, [isOpen, closeResetsFileQueue]);

  useEffect(() => {
    if (selectedFiles.length > 0 && selectedFilesSectionRef.current) {
      selectedFilesSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedFiles.length]);

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setThumbnails(prev => prev.filter((_, i) => i !== index));
    setTitles(prev => prev.filter((_, i) => i !== index));
    setLoading(prev => prev.filter((_, i) => i !== index));
    setProgress(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const hasThumbnailProcessing = selectedFiles.some((_, i) => Boolean(loading[i]));
  const hasMissingThumbnail = selectedFiles.some((_, i) => !thumbnails[i]?.fileType);

  return (
    <div className="upload-clip-container" style={{ minHeight: props.minHeight ?? "" }}>
      {!isFromCommunity && (
        <div className="upload-header">
          <h2 className="upload-title">
            <Video size={28} className="upload-icon" />
            Upload Clip
          </h2>
          <p className="upload-subtitle">Select and upload your video clips</p>
        </div>
      )}

      <div className="upload-form-section">
        <div className="form-field-wrapper">
          <label className="form-label" htmlFor="category">
            <FileText size={18} className="label-icon" />
            Choose Category
          </label>
          <select
            disabled={isUploading}
            id="category"
            className="form-select-custom"
            name="category"
            onChange={(e) => setCategory(e?.target?.value)}
            value={category}
          >
            <option value="" disabled>
              Choose Category
            </option>
            {categoryList?.map((category_type, index) => (
              <option key={index} value={category_type.value}>
                {category_type.label}
              </option>
            ))}
          </select>
        </div>

        {!isFromCommunity && (
          <div className="form-field-wrapper">
            <label className="form-label" htmlFor="uploadTo">
              <Upload size={18} className="label-icon" />
              Upload To
            </label>
            <select
              disabled={isUploading}
              id="uploadTo"
              className="form-select-custom"
              name="uploadTo"
              onChange={(e) => setShareWith(e?.target?.value)}
              value={shareWith}
            >
              {Object.values(shareWithConstants)?.map((category_type, index) => (
                <option key={index} value={category_type}>
                  {category_type}
                </option>
              ))}
            </select>
          </div>
        )}

        {!isFromCommunity && shareWith === shareWithConstants.myFriends && (
          <div className="share-options-wrapper">
            <FriendsPopup
              props={{
                buttonLabel: "Select Friends",
                setSelectedFriends,
                selectedFriends,
                selectedFriendProfiles,
                setSelectedFriendProfiles,
                isFromCommunity,
              }}
            />
            <div className="selection-count">
              <Users size={16} />
              <span>Total Friends Selected: <strong>{selectedFriends.length}</strong></span>
            </div>
            {selectedFriendProfiles.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginTop: "8px",
                  maxHeight: "74px",
                  overflowY: "auto",
                }}
              >
                {selectedFriendProfiles.map((friend) => (
                  <span
                    key={friend._id}
                    style={{
                      background: "#eef2ff",
                      color: "#1e3a8a",
                      border: "1px solid #c7d2fe",
                      borderRadius: "999px",
                      padding: "4px 10px",
                      fontSize: "12px",
                      fontWeight: 600,
                      maxWidth: "160px",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                    }}
                    title={friend.fullname}
                  >
                    {friend.fullname}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {shareWith === shareWithConstants.newUsers && (
          <div className="share-options-wrapper">
            <EmailsPopup props={{ buttonLabel: "Add New User", setSelectedEmails }} />
            <div className="selection-count">
              <Mail size={16} />
              <span>Total Emails Selected: <strong>{selectedEmails.length}</strong></span>
            </div>
          </div>
        )}

        <div className="file-upload-wrapper">
          <label htmlFor="fileUpload" className="file-upload-label">
            <div className="file-upload-content">
              <Upload size={20} className="upload-icon-large" />
              <div className="upload-text">
                <span className="upload-text-main">Click to select videos or drag and drop</span>
              </div>
              <span className="upload-hint">MP4, WebM, QuickTime (Max 50MB)</span>
            </div>
          </label>
          <input
            disabled={isUploading || userInfo.status !== "approved"}
            type="file"
            name="file"
            id="fileUpload"
            onChange={handleFileChange}
            className="file-input-hidden"
            accept="video/*,video/mp4,video/webm,video/quicktime"
            multiple
          />
        </div>
        {selectedFiles.length > 0 && (
          <div
            style={{
              marginTop: "12px",
              padding: "8px 10px",
              borderRadius: "8px",
              border: "1px solid #d1fae5",
              background: "#ecfdf5",
              color: "#065f46",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            {selectedFiles.length} video{selectedFiles.length > 1 ? "s" : ""} selected
          </div>
        )}
      </div>

      {selectedFiles.length > 0 && (
        <div className="selected-files-section" ref={selectedFilesSectionRef}>
          <div className="files-header">
            <h3 className="files-title">
              <Video size={20} />
              Selected Videos ({selectedFiles.length})
            </h3>
          </div>
          <div className="files-list">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${file.size}-${file.lastModified || 0}-${index}`}
                className="file-card"
              >
                <div className="file-card-header">
                  <div className="file-info">
                    <Video size={20} className="file-icon" />
                    <div className="file-details">
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">{formatFileSize(file.size)}</span>
                    </div>
                  </div>
                  <button
                    className="remove-file-btn"
                    onClick={() => removeFile(index)}
                    disabled={isUploading}
                    title="Remove file"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="file-card-body">
                  <div className="form-field-wrapper">
                    <label className="form-label-small">Video Title</label>
                    <input
                      disabled={isUploading}
                      className="form-input-custom"
                      type="text"
                      placeholder="Enter video title..."
                      value={titles[index] || ""}
                      onChange={(e) => handleTitleChange(index, e.target.value)}
                      required
                    />
                  </div>

                  <div className="thumbnail-section">
                    {loading[index] ? (
                      <div className="thumbnail-loading">
                        <Loader size={24} className="spinning" />
                        <span>Generating thumbnail...</span>
                      </div>
                    ) : thumbnails[index]?.dataUrl ? (
                      <div className="thumbnail-wrapper">
                        <div className="thumbnail-container">
                          <img
                            src={thumbnails[index]?.dataUrl}
                            alt="thumbnail"
                            className="thumbnail-image"
                          />
                          <div className="thumbnail-overlay">
                            <CheckCircle size={20} className="check-icon" />
                          </div>
                        </div>
                        {isUploading && progress[index] > 0 && (
                          <div className="progress-container">
                            <div className="progress-bar-wrapper">
                              <div 
                                className="progress-bar-fill" 
                                style={{ width: `${progress[index]}%` }}
                              />
                            </div>
                            <span className="progress-text">{progress[index]}%</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="thumbnail-error">
                        <AlertCircle size={20} />
                        <span>Failed to generate thumbnail. Try another video.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="upload-action-section">
          <Button
            className="upload-button"
            color="primary"
            onClick={handleUpload}
            disabled={isUploading || hasThumbnailProcessing}
            style={{
              backgroundColor: '#007bff',
              borderColor: '#007bff',
              color: '#ffffff',
              minHeight: '44px',
              fontWeight: '600'
            }}
          >
            {isUploading ? (
              <>
                <Loader size={20} className="spinning" style={{ color: '#ffffff' }} />
                <span style={{ color: '#ffffff' }}>Uploading...</span>
              </>
            ) : hasThumbnailProcessing ? (
              <>
                <Loader size={20} className="spinning" style={{ color: '#ffffff' }} />
                <span style={{ color: '#ffffff' }}>Preparing thumbnails...</span>
              </>
            ) : (
              <>
                <Upload size={20} style={{ color: '#ffffff' }} />
                <span style={{ color: '#ffffff' }}>Upload {selectedFiles.length} Video{selectedFiles.length > 1 ? 's' : ''}</span>
              </>
            )}
          </Button>
          {!isUploading && hasMissingThumbnail && !hasThumbnailProcessing && (
            <div style={{ marginTop: "10px", fontSize: "12px", color: "#dc2626", textAlign: "center" }}>
              Some thumbnails are missing. Please remove and re-add that video.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UploadClipCard;