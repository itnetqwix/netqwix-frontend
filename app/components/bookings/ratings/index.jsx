import React, { useEffect, useRef, useState } from "react";
import Rating from "react-rating";
import {
  AccountType,
  BookedSession,
  Message,
  STATUS,
  topNavbarOptions,
  validationMessage,
} from "../../../common/constants";
import { X } from "react-feather";
import { useAppDispatch, useAppSelector } from "../../../store";
import {
  addRatingAsync,
  bookingsState,
  updateBookedSessionScheduledMeetingAsync,
} from "../../common/common.slice";
import * as Yup from "yup";
import { Form, Formik } from "formik";
import { HandleErrorLabel } from "../../../common/error";
import ColoredRating from "../../../common/rating";
import { authAction } from "../../auth/auth.slice";
import { useRouter } from "next/router";
import { useMediaQuery } from "usehooks-ts";

const Ratings = ({ onClose, booking_id, accountType, tabBook, isFromCall, trainer }) => {
  const dispatch = useAppDispatch();
  const formRef = useRef(null);
  const router = useRouter()
  const initialValues = {
    sessionRating: null,
    audioVideoRating: null,
    recommendRating: null,
    title: "",
    remarksInfo: "",
  };

  const validationSchema = Yup.object().shape({
    accountType: Yup.string().default(accountType),
    sessionRating: Yup.number()
      .nullable()
      .required(validationMessage.rating.sessionRating),
    audioVideoRating: Yup.number()
      .nullable()
      .required(validationMessage.rating.audioVideoRating),
    recommendRating: Yup.number().when("accountType", ([type], schema) => {
      if (type !== AccountType.TRAINER)
        return Yup.number()
          .nullable()
          .required(validationMessage.rating.recommandRating);
      return Yup.number().nullable().optional();
    }),
    title: !isFromCall ?Yup.string().nullable().required(validationMessage.rating.title):Yup.string().optional(),
    remarksInfo:!isFromCall ? Yup.string()
      .nullable().required(validationMessage.rating.addRemark): Yup.string()
      .optional()
  });

  const isMobileScreen = useMediaQuery("(max-width:1000px)")
  const getImageUrl = (image) => {
    const backendUrl = "https://netqwix-prod.s3.us-east-2.amazonaws.com/";

    // Check if the image URL is already a full URL (starts with http or https)
    if (
      image &&
      (image.startsWith("http://") || image.startsWith("https://"))
    ) {
      return image;
    }

    // If the image is just a filename, append the backend URL
    return image ? `${backendUrl}${image}` : "/assets/images/demoUser.png";
  };


  return (
    <Formik
      innerRef={formRef}
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={(values) => {
        const updatePayload = {
          id: booking_id,
          booked_status: BookedSession.completed,
        };
        const commonPayload = {
          ...values,
          booking_id,
        };
        const payload = {
          ...(accountType === AccountType.TRAINER
            ? { status: tabBook, updatePayload }
            : { updatePayload }),
        };
        dispatch(updateBookedSessionScheduledMeetingAsync(payload));
        dispatch(addRatingAsync(commonPayload));
        if (isFromCall) {
          dispatch(authAction?.setTopNavbarActiveTab(topNavbarOptions?.HOME));
          router.push("/dashboard")
        }
      }}
    >
      {({
        values,
        errors,
        touched,
        handleSubmit,
        handleBlur,
        setValues,
        isValid,
      }) => (
        <Form onSubmit={handleSubmit}>
          {/* {handleContentOnUserWise(
            values,
            errors,
            touched,
            handleSubmit,
            handleBlur,
            setValues,
            isValid
          )} */}
          <>
            <div className="d-flex justify-content-end">
              <div className="media-body media-body text-right">
                <div
                  className="icon-btn btn-sm btn-outline-light close-apps pointer"
                  onClick={onClose}
                >
                  <X />
                </div>
              </div>
            </div>
            {isFromCall && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  paddingTop: "4px",
                }}
              >
                <img
                  alt={trainer?.fullname}
                  style={{
                    width: isMobileScreen ? 56 : 72,
                    height: isMobileScreen ? 56 : 72,
                    maxWidth: isMobileScreen ? 56 : 72,
                    maxHeight: isMobileScreen ? 56 : 72,
                    objectFit: "cover",
                    borderRadius: "50%",
                  }}
                  src={
                    trainer?.profile_picture
                      ? getImageUrl(trainer?.profile_picture)
                      : "/assets/images/demoUser.png"
                  }
                />
              </div>
            )}

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: isFromCall ? "8px 6px 6px" : "10px 6px 8px",
                textAlign: "center",
              }}
            >
              {isFromCall ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    color: "#333",
                    lineHeight: 1.28,
                    maxWidth: "280px",
                  }}
                >
                  <span style={{ display: "block" }}>
                    Thank you for taking the session
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontWeight: 600,
                      color: "#444",
                      marginTop: "2px",
                    }}
                  >
                    with {trainer?.fullname || "your coach"}
                  </span>
                </p>
              ) : (
                <p
                  style={{
                    margin: 0,
                    textAlign: "center",
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    color: "#333",
                    lineHeight: 1.35,
                    maxWidth: "320px",
                  }}
                >
                  {Message.successMessage.rating}
                </p>
              )}
            </div>
            <div className="container px-0" style={{ maxWidth: "100%", margin: "0 auto" }}>
              <div className="row gx-2" style={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between",
                marginBottom: "0.25rem",
                padding: "6px 0"
              }}>
                <h4 className="col-6 ps-0" style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 600, lineHeight: 1.35 }}>{isFromCall ? "How would you rate your expert?" : "How was your session?"}</h4>
                <div className="col" style={{ display: "flex", justifyContent: "flex-end" }}>
                  <ColoredRating
                    initialRating={values.sessionRating}
                    key={"sessionRating"}
                    onChange={(value) => {
                      setValues({ ...values, sessionRating: value });
                    }}
                  />
                </div>
              </div>
              <div>
                <HandleErrorLabel
                  isError={errors.sessionRating}
                  isTouched={
                    touched.sessionRating && errors.sessionRating ? true : false
                  }
                />
              </div>
              <div className="row gx-2 mt-1 mb-1" style={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between",
                padding: "6px 0"
              }}>
                <h4 className="col-6 ps-0" style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 600, lineHeight: 1.35 }}>{isFromCall ? "How strongly would you recommend " + trainer?.fullname : "Please rate Audio/Video connection"}</h4>
                <div className="col" style={{ display: "flex", justifyContent: "flex-end" }}>
                  <ColoredRating
                    key={"audioVideoRating"}
                    initialRating={values.audioVideoRating}
                    onChange={(value) => {
                      setValues({ ...values, audioVideoRating: value });
                    }}
                  />
                </div>
              </div>
              <div>
                <HandleErrorLabel
                  isError={errors.audioVideoRating}
                  isTouched={
                    touched.audioVideoRating && errors.audioVideoRating
                      ? true
                      : false
                  }
                />
              </div>
              {accountType === AccountType.TRAINER ? (
                <></>
              ) : (
                <>
                  <div className="row gx-2 mt-1 mb-1" style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between",
                    padding: "6px 0"
                  }}>
                    <h4 className="col-6 ps-0" style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 600, lineHeight: 1.35 }}>
                      {isFromCall ? "Please rate your audio/video connection?" : "How strongly would you like to recommend?"}
                    </h4>
                    <div className="col" style={{ display: "flex", justifyContent: "flex-end" }}>
                      <ColoredRating
                        initialRating={values.recommendRating}
                        key={"recommandRating"}
                        onChange={(value) => {
                          setValues({
                            ...values,
                            recommendRating: value,
                          });
                        }}
                      />
                    </div>
                  </div>
                  <div className="mt-1">
                    <HandleErrorLabel
                      isError={errors.recommendRating}
                      isTouched={
                        touched.recommendRating && errors.recommendRating
                          ? true
                          : false
                      }
                    />
                  </div>
                </>
              )}
              {!isFromCall && 
              <>
              <div className="row mt-1">
                <div className="col px-0">
                  <div className="form-group mb-1">
                    <input
                      className="form-control"
                      style={{ fontSize: "0.875rem", lineHeight: 1.35 }}
                      placeholder="Title"
                      value={values.title}
                      onBlur={handleBlur}
                      onChange={(event) => {
                        const { value } = event.target;
                        setValues({ ...values, title: value });
                      }}
                    />
                  </div>
                </div>
              </div>
              <div>
                <HandleErrorLabel
                  isError={errors.title}
                  isTouched={touched.title && errors.title ? true : false}
                />
              </div>
              </>}
              <div className="row mt-1">
                <div className="col px-0">
                  <div className="form-group mb-1">
                    <textarea
                      onChange={(event) => {
                        const { value } = event.target;
                        setValues({ ...values, remarksInfo: value });
                      }}
                      value={values.remarksInfo}
                      placeholder={isFromCall?"Leave a review":"Add Remarks"}
                      onBlur={handleBlur}
                      className="form-control mt-1"
                      style={{ fontSize: "0.875rem", lineHeight: 1.35, minHeight: "72px" }}
                      name=""
                      id=""
                      cols="10"
                      rows={3}
                    ></textarea>
                  </div>
                </div>
              </div>
              <div>
                <HandleErrorLabel
                  isError={errors.remarksInfo}
                  isTouched={
                    touched.remarksInfo && errors.remarksInfo ? true : false
                  }
                />
              </div>
              <div className="d-flex justify-content-center mt-2 pb-1">
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{
                    backgroundColor: '#007bff',
                    borderColor: '#007bff',
                    color: '#ffffff',
                    minHeight: '40px',
                    padding: '0.5rem 1.35rem',
                    fontWeight: '600',
                    borderRadius: '8px',
                    fontSize: '0.875rem'
                  }}
                >
                  Submit
                </button>
              </div>
            </div>
          </>
        </Form>
      )}
    </Formik>
  );
};

export default Ratings;
