import React, { useEffect, useState, useRef, useContext } from "react";
import NavHomePageCenterContainer from "./NavHomePageCenterContainer";
import "./home.scss";
import ShareClipsCard from "../share-clips";
import UploadClipCard from "../videoupload/UploadClipCard";
import InviteFriendsCard from "../invite-friends";
import RecentUsers from "../recent-users";
import { useMediaQuery } from "../../hook/useMediaQuery";
import {
  AccountType,
  bookingButton,
  LIST_OF_ACCOUNT_TYPE,
} from "../../common/constants";
import { useAppDispatch, useAppSelector } from "../../store";
import { authState } from "../auth/auth.slice";
import "./index.scss";
import Slider from "react-slick"; 
import OnlineUserCard from "./banner";
import {
  addTraineeClipInBookedSessionAsync,
  bookingsAction,
  bookingsState,
  getScheduledMeetingDetailsAsync,
} from "../common/common.slice";

import { convertTimesForDataArray, CovertTimeAccordingToTimeZone, formatTimeInLocalZone, Utils, isScheduledSessionLiveNow } from "../../../utils/utils";
import { Button } from "reactstrap";
import { traineeAction } from "../trainee/trainee.slice";
import { addRating } from "../common/common.api";
import TrainerRenderBooking from "../bookings/TrainerRenderBooking";
import TraineeRenderBooking from "../bookings/TraineeRenderBooking";
import { fetchAllLatestOnlineUsers } from "../auth/auth.api";
import { acceptFriendRequest, getFriendRequests, rejectFriendRequest } from "../../common/common.api";
import { toast } from "react-toastify";
import { EVENTS } from "../../../helpers/events";
import { SocketContext } from "../socket";
import { Star } from "react-feather";
import ImageSkeleton from "../common/ImageSkeleton";
import { notificiationTitles } from "../../../utils/constant";
import TrainerCardSkeleton from "../common/TrainerCardSkeleton";
import ActiveSessionSkeleton from "../common/ActiveSessionSkeleton";
import UserInfoCard from "../cards/user-card";
const NavHomePage = () => {
  const [progress, setProgress] = useState(0);
  const width2000 = useMediaQuery(2000);
  const width1200 = useMediaQuery(1200);
  const width1000 = useMediaQuery(1000);
  const width900 = useMediaQuery(900);

  const width600 = useMediaQuery(700);
  const [isOpen, setIsOpen] = useState(false);
  const [isOpenID, setIsOpenID] = useState("");
  const [selectedClips, setSelectedClips] = useState([]);
  const [bookedSession, setBookedSession] = useState({
    id: "",
    booked_status: "",
  });
  const [bIndex, setBIndex] = useState(0);
  const [tabBook, setTabBook] = useState(bookingButton[0]);
  const { removeNewBookingData } = traineeAction;
  const { isLoading, configs, startMeeting, isMeetingLoading } = useAppSelector(bookingsState);
  const { accountType, onlineUsers } = useAppSelector(authState);
  const [activeTrainer, setActiveTrainer] = useState([]);
  const [isLoadingTrainers, setIsLoadingTrainers] = useState(true);
  const [friendRequests, setFriendRequests] = useState([]);
  const [filteredSessions, setFilteredSessions] = useState([]);
  const [activeCenterTab, setActiveCenterTab] = useState("myClips");
  const [selectedTraineeId, setSelectedTraineeId] = useState(null);
  const socket = useContext(SocketContext);
  
  // Use refs to prevent duplicate API calls when switching tabs
  const hasFetchedFriendRequestsRef = useRef(false);
  const hasFetchedActiveTrainerRef = useRef(false);
  const hasFetchedScheduledMeetingsRef = useRef(false);
  // Track if we've completed the first load of scheduled meetings (so we don't show active-session skeleton when there are none)
  const hasScheduledMeetingsLoadedOnceRef = useRef(false);
  
  
  const getFriendRequestsApi = async () => {
    try {
      let res = await getFriendRequests();
      setFriendRequests(res?.friendRequests);
       
    } catch (error) {
       
    }
  };

  useEffect(() => {
    // Only fetch if not already fetched
    if (!hasFetchedFriendRequestsRef.current) {
      hasFetchedFriendRequestsRef.current = true;
      getFriendRequestsApi();
    }
  }, []);

  const handleAcceptFriendRequest = async (requestId) => {
    try {
      await acceptFriendRequest({ requestId });
      toast.success("Friend request accepted");
      getFriendRequestsApi();
    } catch (error) {
      toast.error(error);
    }
  };

  const handleRejectFriendRequest = async (requestId) => {
    try {
      await rejectFriendRequest({ requestId });
      toast.success("Friend request rejected");
      getFriendRequestsApi();
    } catch (error) {
      toast.error(error);
    }
  };

  const getAllLatestActiveTrainer = async () => {
    try {
      setIsLoadingTrainers(true);
      const response = await fetchAllLatestOnlineUsers();

      if (response.code === 200) {
        setActiveTrainer(response.result);
      }
    } catch (error) {
      console.error("Error fetching active trainers:", error);
    } finally {
      setIsLoadingTrainers(false);
    }
  };

  //comment added

  const [userTimeZone, setUserTimeZone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const dispatch = useAppDispatch();
  const { scheduledMeetingDetails } = useAppSelector(bookingsState);
  const shouldShowCoachesSection =
    accountType === AccountType.TRAINEE &&
    (isLoadingTrainers || (activeTrainer && activeTrainer.length > 0));
  
  // Always fetch scheduled meetings on mount so Active Sessions show correctly
  // when sessions are booked (matches behavior at 9ebdf7b – active sessions on trainer/trainee).
  useEffect(() => {
    if (!hasFetchedScheduledMeetingsRef.current) {
      hasFetchedScheduledMeetingsRef.current = true;
      dispatch(getScheduledMeetingDetailsAsync());
    }
  }, [dispatch]);

  /**
   * Keep scheduled meetings (and therefore Active Sessions) in sync in real-time.
   * When a booking is created or its status changes, we silently refetch the
   * full scheduledMeetingDetails list so ActiveSessionsSection and related
   * components always reflect the latest state for both trainee and trainer.
   */
  useEffect(() => {
    if (!socket) return;

    const handleBookingUpdate = () => {
      // One full-list fetch is enough — the slice derives "upcoming", "completed" etc.
      // from the full list in its fulfilled reducer, so we never need two parallel calls.
      dispatch(getScheduledMeetingDetailsAsync({ forceRefresh: true }));
    };

    // Listen for push notifications that indicate booking updates
    const handleNotification = (notification) => {
      if (
        notification.title === notificiationTitles.newBookingRequest ||
        notification.title === notificiationTitles.sessionStrated ||
        notification.title === notificiationTitles.sessionConfirmation
      ) {
        // Short delay only for push so backend has written; socket events refresh immediately
        setTimeout(() => handleBookingUpdate(), 300);
      }
    };

    socket.on(EVENTS.PUSH_NOTIFICATIONS.ON_RECEIVE, handleNotification);
    socket.on(EVENTS.INSTANT_LESSON.ACCEPT, handleBookingUpdate);
    socket.on(EVENTS.BOOKING.CREATED, handleBookingUpdate);
    socket.on(EVENTS.BOOKING.STATUS_UPDATED, handleBookingUpdate);

    return () => {
      if (socket) {
        socket.off(EVENTS.PUSH_NOTIFICATIONS.ON_RECEIVE, handleNotification);
        socket.off(EVENTS.INSTANT_LESSON.ACCEPT, handleBookingUpdate);
        socket.off(EVENTS.BOOKING.CREATED, handleBookingUpdate);
        socket.off(EVENTS.BOOKING.STATUS_UPDATED, handleBookingUpdate);
      }
    };
  }, [socket, dispatch]);
  
  useEffect(() => {
    // Only fetch active trainers if not already fetched
    if (!hasFetchedActiveTrainerRef.current) {
      hasFetchedActiveTrainerRef.current = true;
      getAllLatestActiveTrainer();
    }
  }, []);

  var settings = {
    autoplay: false,
    infinite: false,
    speed: 400,
    slidesToShow: width600 ? 2.5 : width900 ? 3 : 4,
    slidesToScroll: 1,
    dots: false,
    arrows: activeTrainer?.length > (width600 ? 2.5 : width900 ? 3 : 4),
    swipe: true,
    swipeToSlide: true,
    touchMove: true,
    touchThreshold: 5,
    draggable: true,
    variableWidth: false,
    adaptiveHeight: true,
    lazyLoad: 'ondemand', // Enable lazy loading for slides
    cssEase: 'ease-in-out',
    responsive: [
      {
        breakpoint: 1200,
        settings: {
          slidesToShow: 3,
          slidesToScroll: 1,
          swipe: true,
          swipeToSlide: true,
          touchMove: true,
          draggable: true,
          arrows: activeTrainer?.length > 3,
        },
      },
      {
        breakpoint: 900,
        settings: {
          slidesToShow: 2.5,
          slidesToScroll: 1,
          swipe: true,
          swipeToSlide: true,
          touchMove: true,
          draggable: true,
          arrows: activeTrainer?.length > 2.5,
        },
      },
      {
        breakpoint: 600,
        settings: {
          slidesToShow: 2.5,
          slidesToScroll: 1,
          swipe: true,
          swipeToSlide: true,
          touchMove: true,
          draggable: true,
          arrows: activeTrainer?.length > 2.5,
        },
      },
      {
        breakpoint: 480,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 1,
          swipe: true,
          swipeToSlide: true,
          touchMove: true,
          draggable: true,
          arrows: activeTrainer?.length > 2,
        },
      },
    ],
  };
   

  // Mark that we've completed at least one load of scheduled meetings (so we hide active-session skeleton when there are none)
  useEffect(() => {
    if (!isMeetingLoading) {
      hasScheduledMeetingsLoadedOnceRef.current = true;
    }
  }, [isMeetingLoading]);

  // Active Sessions: truly in-window now (anchored to booked_date when times are HH:mm only)
  useEffect(() => {
    if (!scheduledMeetingDetails?.length) {
      setFilteredSessions([]);
      return;
    }
    setFilteredSessions(
      scheduledMeetingDetails.filter((session) => isScheduledSessionLiveNow(session))
    );
  }, [scheduledMeetingDetails]);

  const addTraineeClipInBookedSession = async (selectedClips) => {
    const payload = {
      id: isOpenID,
      trainee_clip: selectedClips?.map((val) => val?._id),
    };
    dispatch(addTraineeClipInBookedSessionAsync(payload));
    dispatch(removeNewBookingData());
    setIsOpen(false);
    // setIsModalOpen(false);
  };

  const MeetingSetter = (payload) => {
    dispatch(bookingsAction.setStartMeeting(payload));
  };

  const handleAddRatingModelState = (data) => {
    dispatch(addRating(data));
  };

  const showRatingLabel = (ratingInfo) => {
    // for trainee we're showing recommends
    return ratingInfo &&
      ratingInfo[accountType.toLowerCase()] &&
      (ratingInfo[accountType.toLowerCase()].sessionRating ||
        ratingInfo[accountType.toLowerCase()].sessionRating) ? (
      <div className="d-flex items-center">
        {" "}
        {/* You rated{" "} */}
        You rated this session{" "}
        <b className="pl-2">
          {ratingInfo[accountType.toLowerCase()].sessionRating ||
            ratingInfo[accountType.toLowerCase()].sessionRating}
        </b>
        <Star color="#FFC436" size={28} className="star-container star-svg" />{" "}
        stars
        {/* to this {accountType?.toLowerCase()}. */}
      </div>
    ) : null;
  };

  const renderBooking = (
    bookingInfo,
    status,
    booking_index,
    _id,
    trainee_info,
    trainer_info,
    ratings,
    trainee_clips,
    report
  ) => {
    const { availabilityInfo } = Utils.normalizeBookingTimes(bookingInfo);
    const {
      isStartButtonEnabled,
      has24HoursPassedSinceBooking,
      isCurrentDateBefore,
      isUpcomingSession,
    } = availabilityInfo;

    switch (accountType) {
      case AccountType.TRAINER:
        return (
          <TrainerRenderBooking
            _id={_id}
            status={status}
            trainee_info={trainee_info}
            trainer_info={trainer_info}
            isCurrentDateBefore={isCurrentDateBefore}
            isStartButtonEnabled={isStartButtonEnabled}
            isMeetingDone={false}
            isUpcomingSession={isUpcomingSession}
            ratings={ratings}
            booking_index={booking_index}
            has24HoursPassedSinceBooking={has24HoursPassedSinceBooking}
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            selectedClips={selectedClips}
            setSelectedClips={setSelectedClips}
            setIsOpenID={setIsOpenID}
            addTraineeClipInBookedSession={addTraineeClipInBookedSession}
            trainee_clips={trainee_clips}
            report={report}
            bookedSession={bookedSession}
            setBookedSession={setBookedSession}
            tabBook={tabBook}
            setStartMeeting={MeetingSetter}
            startMeeting={startMeeting}
            handleAddRatingModelState={handleAddRatingModelState}
            updateParentState={(value) => {
              setBIndex(value);
            }}
            activeTabs={bookingButton[0]}
            start_time={bookingInfo?.start_time}
            bookingInfo={bookingInfo}
          />
        );
      case AccountType.TRAINEE:
        return (
          <TraineeRenderBooking
            _id={_id}
            status={status}
            trainee_info={trainee_info}
            trainer_info={trainer_info}
            isCurrentDateBefore={isCurrentDateBefore}
            isStartButtonEnabled={isStartButtonEnabled}
            isMeetingDone={false}
            isUpcomingSession={isUpcomingSession}
            ratings={ratings}
            booking_index={booking_index}
            has24HoursPassedSinceBooking={has24HoursPassedSinceBooking}
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            selectedClips={selectedClips}
            setSelectedClips={setSelectedClips}
            setIsOpenID={setIsOpenID}
            isOpenID={isOpenID}
            addTraineeClipInBookedSession={addTraineeClipInBookedSession}
            trainee_clips={trainee_clips}
            report={report}
            bookedSession={bookedSession}
            setBookedSession={setBookedSession}
            tabBook={tabBook}
            setStartMeeting={MeetingSetter}
            startMeeting={startMeeting}
            handleAddRatingModelState={handleAddRatingModelState}
            updateParentState={(value) => {
              setBIndex(value);
            }}
            accountType={AccountType.TRAINEE}
            activeTabs={bookingButton[0]}
            start_time={bookingInfo?.start_time}
            bookingInfo={bookingInfo}
          />
        );
      default:
        break;
    }
  };
  // ── Design tokens ────────────────────────────────────────────────────────
  const card = {
    background: "#ffffff",
    borderRadius: "14px",
    boxShadow: "0 2px 16px rgba(0,0,0,0.07)",
    border: "1px solid rgba(0,0,0,0.05)",
    overflow: "hidden",
  };
  const sectionGap = width600 ? 16 : 20;

  // ── Section header helper ────────────────────────────────────────────────
  const SectionHeader = ({ title, badge }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <div style={{ width: 4, height: 20, background: "#000080", borderRadius: 3, flexShrink: 0 }} />
      <h2 style={{ margin: 0, fontSize: width600 ? 16 : 18, fontWeight: 700, color: "#111", letterSpacing: "0.2px" }}>
        {title}
      </h2>
      {badge != null && (
        <span style={{
          marginLeft: "auto",
          background: "#e8f0fe",
          color: "#000080",
          fontSize: 11,
          fontWeight: 700,
          padding: "2px 10px",
          borderRadius: 20,
          letterSpacing: "0.3px",
        }}>
          {badge}
        </span>
      )}
    </div>
  );

  return (
    <div style={{ padding: width600 ? "8px 8px" : "10px 14px", maxWidth: "100%", boxSizing: "border-box" }}>

      {/* Status banners live inside NavHomePageCenterContainer where userInfo actions are scoped */}

      {/* ── Coaches Online Now (trainees only) ──────────────────────────── */}
      {shouldShowCoachesSection && (
        <section style={{ marginBottom: sectionGap }}>
          <SectionHeader
            title="Coaches Online Now"
            badge={!isLoadingTrainers ? `${activeTrainer?.length || 0} Online` : null}
          />
          <div style={{
            ...card,
            padding: width600 ? "12px 8px 8px" : "14px 20px 10px",
          }}>
            <div className="banner_Slider" style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", position: "relative" }}>
              <style>{`
                .banner_Slider { position: relative; -webkit-overflow-scrolling: touch; }
                .banner_Slider .slick-list { margin: 0 -10px; touch-action: pan-y pinch-zoom; overflow: visible; }
                .banner_Slider .slick-slide { height: auto; min-height: 0; padding: 0 10px; touch-action: pan-y pinch-zoom; display: flex; }
                .banner_Slider .slick-slide > div { height: 100%; display: flex; min-height: 0; }
                .banner_Slider .slick-track { touch-action: pan-y pinch-zoom; display: flex; align-items: stretch; }
                .banner_Slider .slick-slide[aria-hidden="true"] { opacity: 0.45; transition: opacity 0.25s ease; }
                .banner_Slider .slick-slide[aria-hidden="false"] { opacity: 1; transition: opacity 0.25s ease; }
                .banner_Slider .slick-prev, .banner_Slider .slick-next {
                  z-index: 10; width: 34px; height: 34px; background: #fff !important;
                  border-radius: 50%; box-shadow: 0 2px 10px rgba(0,0,0,0.13);
                  transition: background 0.2s ease, box-shadow 0.2s ease;
                  display: flex !important; align-items: center; justify-content: center;
                }
                .banner_Slider .slick-prev:hover, .banner_Slider .slick-next:hover {
                  background: #000080 !important; box-shadow: 0 4px 14px rgba(0,0,128,0.28);
                }
                .banner_Slider .slick-prev:before, .banner_Slider .slick-next:before { color: #000080; font-size: 18px; opacity: 1; }
                .banner_Slider .slick-prev:hover:before, .banner_Slider .slick-next:hover:before { color: #fff; }
                .banner_Slider .slick-prev { left: -10px; }
                .banner_Slider .slick-next { right: -10px; }
                .banner_Slider .slick-prev.slick-disabled, .banner_Slider .slick-next.slick-disabled { opacity: 0.25; cursor: not-allowed; }
                @media (max-width: 600px) {
                  .banner_Slider .slick-list { margin: 0 -5px; }
                  .banner_Slider .slick-slide { padding: 0 5px; }
                  .banner_Slider .slick-prev { left: -4px; } .banner_Slider .slick-next { right: -4px; }
                  .banner_Slider .slick-prev, .banner_Slider .slick-next { width: 30px; height: 30px; }
                  .banner_Slider .slick-prev:before, .banner_Slider .slick-next:before { font-size: 16px; }
                }
              `}</style>
              {isLoadingTrainers ? (
                <Slider {...settings}>
                  {Array(4).fill(0).map((_, i) => (
                    <div key={`sk-${i}`} style={{ padding: width600 ? "0 4px" : "0 10px", boxSizing: "border-box", display: "flex", alignItems: "stretch" }}>
                      <div style={{ width: "100%", display: "flex", alignItems: "stretch" }}>
                        <TrainerCardSkeleton width600={width600} />
                      </div>
                    </div>
                  ))}
                </Slider>
              ) : activeTrainer?.length > 0 ? (
                <Slider {...settings}>
                  {activeTrainer.map((info, i) => (
                    <div key={`tr-${info.trainer_info?._id}-${i}`} style={{ padding: width600 ? "0 4px" : "0 10px", boxSizing: "border-box", display: "flex", alignItems: "stretch" }}>
                      <div style={{ width: "100%", display: "flex", alignItems: "stretch" }}>
                        <OnlineUserCard trainer={info.trainer_info} />
                      </div>
                    </div>
                  ))}
                </Slider>
              ) : null}
            </div>
          </div>
        </section>
      )}

      {/* ── Active Sessions ──────────────────────────────────────────────── */}
      {filteredSessions?.length > 0 ? (
        <section style={{ marginBottom: sectionGap }}>
          <SectionHeader title="Active Sessions" badge={`${filteredSessions.length} Live`} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredSessions.map((session, booking_index) => {
              const { displayStartTime, displayEndTime } = Utils.normalizeBookingTimes(session);
              const partnerName = accountType === AccountType.TRAINER
                ? session.trainee_info.fullname
                : session.trainer_info.fullname;
              const partnerPic = Utils.getImageUrlOfS3(
                accountType === AccountType.TRAINER
                  ? session.trainee_info.profile_picture
                  : session.trainer_info.profile_picture
              ) || "/assets/images/demoUser.png";
              return (
                <div key={`session-${session._id || booking_index}`} style={{
                  ...card,
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  gap: width600 ? 12 : 18,
                  flexWrap: width600 ? "wrap" : "nowrap",
                  transition: "box-shadow 0.2s ease",
                }}>
                  {/* Avatar */}
                  <div style={{ flexShrink: 0, position: "relative" }}>
                    <div style={{ width: 58, height: 58, borderRadius: 10, overflow: "hidden", border: "2px solid #000080" }}>
                      <ImageSkeleton
                        src={partnerPic}
                        alt={partnerName}
                        fallbackSrc="/assets/images/demoUser.png"
                        lazy={booking_index > 0}
                        priority={booking_index === 0}
                        skeletonType="rounded"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    {/* Live indicator */}
                    <span style={{
                      position: "absolute", bottom: -2, right: -2,
                      width: 14, height: 14, background: "#22c55e",
                      borderRadius: "50%", border: "2px solid #fff",
                    }} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#111", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {partnerName}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 12, color: "#666" }}>
                      <span>📅 {Utils.getDateInFormat(session.booked_date)}</span>
                      <span>🕐 {displayStartTime} – {displayEndTime}</span>
                      {session.createdAt && (
                        <span>📌 Booked {Utils.getDateInFormat(session.createdAt)} {formatTimeInLocalZone(session.createdAt)}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    {showRatingLabel(session.ratings)}
                    {renderBooking(session, session.status, booking_index, session._id, session.trainee_info, session.trainer_info, session.ratings, session.trainee_clips, session.report)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : isMeetingLoading && !hasScheduledMeetingsLoadedOnceRef.current ? (
        <section style={{ marginBottom: sectionGap }}>
          <SectionHeader title="Active Sessions" />
          {Array(2).fill(0).map((_, i) => (
            <ActiveSessionSkeleton key={`as-sk-${i}`} width600={width600} />
          ))}
        </section>
      ) : null}

      {/* ── Main content grid ────────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: width600 ? "1fr" : width1200 ? "1fr" : width2000 ? "280px 1fr 240px" : "1fr",
        gap: sectionGap,
        alignItems: "start",
      }}>

        {/* ── LEFT column: sidebar cards ─────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: width1200 && !width600 ? "row" : "column", gap: sectionGap, flexWrap: "wrap" }}>

          {/* Friend Requests */}
          {width1000 && friendRequests?.length > 0 && (
            <div style={{ flex: width1200 && !width600 ? "1 1 calc(50% - 10px)" : "1 1 100%", minWidth: 0 }}>
              <div style={card}>
                <div style={{ padding: "14px 16px 6px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                  <SectionHeader title="Friend Requests" badge={friendRequests.length} />
                </div>
                <div style={{ padding: "12px 16px", display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
                  {friendRequests.map((request, i) => (
                    <div key={i} style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,128,0.15)",
                      background: "linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%)",
                      cursor: "pointer",
                      transition: "box-shadow 0.2s ease, transform 0.15s ease",
                      minWidth: 110,
                    }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,128,0.12)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}
                    >
                      <div style={{ width: 72, height: 72, borderRadius: 10, overflow: "hidden", border: "2px solid rgba(0,0,128,0.2)" }}>
                        <ImageSkeleton
                          src={Utils?.getImageUrlOfS3(request.senderId?.profile_picture) || "/assets/images/userdemo.png"}
                          alt={request.senderId?.fullname || "User"}
                          fallbackSrc="/assets/images/demoUser.png"
                          lazy={true}
                          skeletonType="rounded"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#111", textAlign: "center", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {request.senderId?.fullname}
                      </span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="btn btn-success btn-sm"
                          style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, fontWeight: 600 }}
                          onClick={(e) => { e.stopPropagation(); handleAcceptFriendRequest(request?._id); }}
                        >
                          Accept
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, fontWeight: 600 }}
                          onClick={(e) => { e.stopPropagation(); handleRejectFriendRequest(request?._id); }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Trainer Profile */}
          {accountType === AccountType?.TRAINER && (
            <div style={{ flex: width1200 && !width600 ? "1 1 calc(50% - 10px)" : "1 1 100%", minWidth: 0 }}>
              <div style={card}>
                <UserInfoCard />
              </div>
            </div>
          )}

          {/* Recent Students */}
          <div style={{ flex: width1200 && !width600 ? "1 1 calc(50% - 10px)" : "1 1 100%", minWidth: 0 }}>
            <div style={{ ...card, padding: "14px 16px" }}>
              <RecentUsers
                onTraineeSelect={(traineeId) => {
                  setSelectedTraineeId(traineeId);
                  setActiveCenterTab("myClips");
                }}
              />
            </div>
          </div>
        </div>

        {/* ── CENTER column: clips / reports ─────────────────────────── */}
        <div>
          <div style={{ ...card, padding: width600 ? "10px" : "16px" }}>
            <NavHomePageCenterContainer
              onTabChange={setActiveCenterTab}
              selectedTraineeId={selectedTraineeId}
              onClearTrainee={() => setSelectedTraineeId(null)}
            />
          </div>
        </div>

        {/* ── RIGHT column: upload / sponsor images / invite ──────────── */}
        <div style={{ display: "flex", flexDirection: width1200 && !width600 ? "row" : "column", gap: sectionGap, flexWrap: "wrap" }}>

          {/* Upload clip */}
          <div style={{ flex: width1200 && !width600 ? "1 1 calc(50% - 10px)" : "1 1 100%", minWidth: 0 }}>
            <div style={{ ...card, padding: "16px" }}>
              <UploadClipCard progress={progress} setProgress={setProgress} />
            </div>
          </div>

          {/* Invite friends */}
          <div style={{ flex: width1200 && !width600 ? "1 1 calc(50% - 10px)" : "1 1 100%", minWidth: 0 }}>
            <div style={{ ...card, padding: "16px" }}>
              <InviteFriendsCard />
            </div>
          </div>

          {/* Sponsor image 1 */}
          <div style={{ flex: width1200 && !width600 ? "1 1 calc(50% - 10px)" : "1 1 100%", minWidth: 0 }}>
            <div style={{ ...card, overflow: "hidden", cursor: "pointer", transition: "transform 0.2s ease, box-shadow 0.2s ease" }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.015)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(0,0,0,0.12)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 2px 16px rgba(0,0,0,0.07)"; }}
            >
              <img
                src="/assets/images/dashboard-card.webp"
                alt="dashboard card"
                style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
                onError={(e) => { e.target.src = "/assets/images/dashboard-card.webp"; }}
              />
            </div>
          </div>

          {/* Sponsor image 2 */}
          <div style={{ flex: width1200 && !width600 ? "1 1 calc(50% - 10px)" : "1 1 100%", minWidth: 0 }}>
            <div style={{ ...card, overflow: "hidden", cursor: "pointer", transition: "transform 0.2s ease, box-shadow 0.2s ease" }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.015)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(0,0,0,0.12)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 2px 16px rgba(0,0,0,0.07)"; }}
            >
              <img
                src="/assets/images/callaway.jpg"
                alt="callaway card"
                style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
                onError={(e) => { e.target.src = "/assets/images/callaway.jpg"; }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NavHomePage;
