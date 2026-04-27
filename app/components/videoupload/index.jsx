import React, { useEffect, useState, useRef } from "react";
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


const VideoUpload = (props) => {
    const { isOpen } = useAppSelector(videouploadState);
    const dispatch = useAppDispatch();
    const [progress, setProgress] = useState(0)
    const [uploadSessionKey, setUploadSessionKey] = useState(0);
    const ref = useRef();



    useEffect(() => {
        if (isOpen) setProgress(0)
    }, [isOpen]);

    // const resetForm = () => {
    //     setTitle("");
    //     setCategory({});
    //     setSelectedFile(null);
    // }




    return (<Modal
        isOpen={isOpen}
        allowFullWidth
        scrollableBody
        backdrop="static"
        keyboard={false}
        toggle={() => dispatch(videouploadAction.setIsOpen(false))}
        element={
            <div
              className="video-upload-modal-inner"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="theme-title">
                    <div className="media">
                        <div className="media-body media-body text-right">
                            {!progress && <div className="icon-btn btn-sm btn-outline-light close-apps pointer" onClick={() => {
                                dispatch(videouploadAction?.setIsOpen(false));
                                setUploadSessionKey((k) => k + 1);
                            }} > <X /> </div>}
                        </div>
                    </div>
                </div>
                <UploadClipCard
                  key={uploadSessionKey}
                  progress={progress}
                  setProgress={setProgress}
                  minHeight="100vh"
                  fullWidthContent
                />
            </div>
        }
    />)
}
export default VideoUpload;
