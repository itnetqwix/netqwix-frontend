import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAppDispatch, useAppSelector } from '../../store';
import { authAction, authState } from '../../components/auth/auth.slice';
import {
  bookingsAction,
  bookingsState,
  getScheduledMeetingDetailsAsync,
} from '../../components/common/common.slice';
import { LOCAL_STORAGE_KEYS, topNavbarOptions } from '../../common/constants';
import { useMediaQuery } from 'usehooks-ts';
import { useWindowDimensions } from '../../hook/useWindowDimensions';
import OrientationModal from '../../components/modalComponent/OrientationModal';
import VideoCallUI from '.';

/**
 * MeetingPage
 * Owns all data-fetching, meeting-lookup, and status-routing for the /meeting route.
 * Extracted from pages/meeting/index.jsx so that page stays a thin shell.
 */

const MeetingLoadingState = ({ message = 'Loading meeting details...' }) => (
  <div
    style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f8fafc',
      padding: '24px',
      boxSizing: 'border-box',
    }}
  >
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '14px',
        color: '#1f2937',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          border: '4px solid #dbeafe',
          borderTopColor: '#2563eb',
          animation: 'meeting-page-loader-spin 0.8s linear infinite',
        }}
      />
      <div style={{ fontSize: '16px', fontWeight: 500 }}>{message}</div>
      <style jsx>{`
        @keyframes meeting-page-loader-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  </div>
);

const RenderVideoCall = ({ height, width, isRotatedInitally }) => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const id = router?.query?.id;

  const { scheduledMeetingDetails, startMeeting } = useAppSelector(bookingsState);
  const { accountType } = useAppSelector(authState);

  const meetingDetails = scheduledMeetingDetails?.find((m) => m._id === id);

  const MeetingSetter = (payload) => {
    dispatch(bookingsAction.setStartMeeting(payload));
  };

  useEffect(() => {
    if (meetingDetails?._id) {
      MeetingSetter({
        ...startMeeting,
        id: meetingDetails._id,
        isOpenModal: true,
        traineeInfo: meetingDetails.trainee_info,
        trainerInfo: meetingDetails.trainer_info,
        iceServers: meetingDetails.iceServers,
        trainee_clip: meetingDetails.trainee_clips || meetingDetails.trainee_clip || [],
      });
    }
  }, [meetingDetails]);

  if (!meetingDetails) {
    return <MeetingLoadingState message="Preparing your meeting session..." />;
  }

  return (
    <VideoCallUI
      id={meetingDetails._id}
      accountType={accountType}
      isInstantLesson={!!meetingDetails?.is_instant}
      traineeInfo={meetingDetails.trainee_info}
      trainerInfo={meetingDetails.trainer_info}
      session_end_time={meetingDetails.session_end_time}
      session_start_time={meetingDetails.session_start_time}
      extended_session_end_time={meetingDetails.extended_session_end_time}
      time_zone={meetingDetails.time_zone}
      isClose={() => {
        MeetingSetter({ id: null, isOpenModal: false, traineeInfo: null, trainerInfo: null });
        dispatch(authAction?.setTopNavbarActiveTab(topNavbarOptions?.HOME));
        router.push('/dashboard');
      }}
      isLandscape={height < width}
    />
  );
};

export default function MeetingPage() {
  const { height, width } = useWindowDimensions();
  const [isRotatedInitally, setIsRotatedInitally] = useState(false);
  const mediaQuery = useMediaQuery('(min-width: 992px)');

  const dispatch = useAppDispatch();
  const router = useRouter();
  const id = router?.query?.id;

  const { scheduledMeetingDetails, loading, configs } = useAppSelector(bookingsState);
  const { accountType } = useAppSelector(authState);

  const meetingDetails = scheduledMeetingDetails?.find((m) => m._id === id);

  useEffect(() => {
    if (height < width) setIsRotatedInitally(true);
  }, [height, width]);

  // Fetch meeting list on arrival (TTL cache in thunk prevents duplicate calls)
  useEffect(() => {
    if (id) {
      dispatch(getScheduledMeetingDetailsAsync({ id }));
      dispatch(authAction?.setAccountType(localStorage.getItem(LOCAL_STORAGE_KEYS?.ACC_TYPE)));
    }
  }, [dispatch, id]);

  // One retry if id is present but meeting not yet found
  useEffect(() => {
    if (id && !meetingDetails && !loading) {
      const timer = setTimeout(() => {
        dispatch(getScheduledMeetingDetailsAsync({ id, forceRefresh: true }));
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [id, meetingDetails, loading, dispatch]);

  useEffect(() => {
    if (id && !meetingDetails && scheduledMeetingDetails?.length > 0 && !loading) {
      console.warn('[MeetingPage] Booking not found:', {
        bookingId: id,
        totalBookings: scheduledMeetingDetails.length,
      });
    }
  }, [id, meetingDetails, scheduledMeetingDetails, loading]);

  if (!accountType) return <MeetingLoadingState message="Loading your profile..." />;

  if (loading || (id && !meetingDetails && scheduledMeetingDetails?.length === 0)) {
    return <MeetingLoadingState message="Loading meeting details..." />;
  }

  if (!meetingDetails && id && !loading && scheduledMeetingDetails?.length > 0) {
    return <div className="booking-status-message">Meeting not found. Please check your bookings and try again.</div>;
  }

  if (!meetingDetails) return <MeetingLoadingState message="Preparing your meeting session..." />;

  switch (meetingDetails.status) {
    case 'confirmed':
      return (
        <div id="get-navbar-tabs" className="get-navbar-tabs">
          <div
            id="bookings"
            className={
              mediaQuery
                ? 'video_call custom-scroll position-relative'
                : 'custom-scroll scoll-content position-relative'
            }
          >
            <RenderVideoCall height={height} width={width} isRotatedInitally={isRotatedInitally} />
          </div>
        </div>
      );
    case 'cancelled':
      return <div className="booking-status-message">This booking has been cancelled.</div>;
    case 'booked':
      return <div className="booking-status-message">Please wait until the booking is confirmed.</div>;
    case 'completed':
      return <div className="booking-status-message">This booking is already completed.</div>;
    default:
      return <div className="booking-status-message">Invalid booking status. Please check again.</div>;
  }
}
