import React, { useEffect, useState } from "react";
import { videouploadState, videouploadAction } from "./videoupload.slice";
import { useAppSelector, useAppDispatch } from "../../store";
import Modal from "../../common/modal";
import { Button, Form, FormGroup, Label, Input } from 'reactstrap';
import { getS3SignUrl } from "./videoupload.api";
import { LIST_OF_ACCOUNT_TYPE } from "../../common/constants";
import { getMasterData } from "../master/master.api";
import axios from "axios";
import { X } from "react-feather";
import UploadClipCard from "./UploadClipCard";


const VideoUpload = ({ onUploadSuccess }) => {
    const { isOpen } = useAppSelector(videouploadState);
    const dispatch = useAppDispatch();
    // UploadClipCard expects `progress` to be an array (per-file).
    // Keep the type consistent to avoid closing/interaction issues.
    const [progress, setProgress] = useState([]);
    const [uploadBusy, setUploadBusy] = useState(false);
    const [uploadSessionKey, setUploadSessionKey] = useState(0);



    useEffect(() => {
        if (isOpen) {
            setProgress([]);
            // Force a fresh UploadClipCard instance for each open
            // so file inputs and selected files never leak between sessions.
            setUploadSessionKey((prev) => prev + 1);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) setUploadBusy(false);
    }, [isOpen]);

    // const resetForm = () => {
    //     setTitle("");
    //     setCategory({});
    //     setSelectedFile(null);
    // }




    const closeUpload = () => {
        if (uploadBusy) return;
        dispatch(videouploadAction?.setIsOpen(false));
    };

    return (
        <Modal
            isOpen={isOpen}
            toggle={closeUpload}
            zIndex={100100}
            backdrop={uploadBusy ? "static" : true}
            keyboard={!uploadBusy}
            centered
            allowFullWidth
            scrollableBody
            trapFocus={false}
            autoFocus={false}
            className="clip-selection-modal upload-clip-library-modal"
            element={
                <div
                    style={{
                        width: "100%",
                        maxHeight: "min(92vh, 960px)",
                        overflowY: "auto",
                        overflowX: "hidden",
                    }}
                >
                    <div className="theme-title">
                        <div className="media">
                            <div className="media-body media-body text-right">
                                {!uploadBusy && (
                                    <button
                                        type="button"
                                        className="icon-btn btn-sm btn-outline-light close-apps pointer border-0 bg-transparent"
                                        onClick={closeUpload}
                                        aria-label="Close upload"
                                    >
                                        <X />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    <UploadClipCard
                        key={uploadSessionKey}
                        progress={progress}
                        setProgress={setProgress}
                        minHeight=""
                        onUploadBusyChange={setUploadBusy}
                        onUploadSuccess={onUploadSuccess}
                    />
                </div>
            }
        />
    );
}
export default VideoUpload;
