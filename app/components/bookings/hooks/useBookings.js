import { useState, useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store';
import {
  bookingsState,
  getScheduledMeetingDetailsAsync,
} from '../../common/common.slice';
import { AccountType, BookedSession } from '../../../common/constants';
import { Utils } from '../../../../utils/utils';

/**
 * Custom hook for managing bookings data and operations
 * Extracted from bookings/index.jsx to improve maintainability
 */
export const useBookings = ({ accountType }) => {
  const dispatch = useAppDispatch();
  const { scheduledMeetingDetails, isLoading } = useAppSelector(bookingsState);
  const [activeTabs, setActiveTab] = useState('Upcoming');
  const [bIndex, setBIndex] = useState(0);
  const [bookedSession, setBookedSession] = useState({
    id: '',
    booked_status: '',
  });

  const fetchBookings = useCallback(() => {
    dispatch(getScheduledMeetingDetailsAsync());
  }, [dispatch]);

  const isMeetingCompleted = useCallback(
    (detail) => {
      return (
        detail.status === BookedSession.completed ||
        (detail &&
          detail.ratings &&
          detail.ratings[accountType?.toLowerCase()] &&
          detail.ratings[accountType?.toLowerCase()].sessionRating)
      );
    },
    [accountType]
  );

  const filterBookingsByStatus = useCallback(
    (status) => {
      if (!scheduledMeetingDetails?.length) return [];

      return scheduledMeetingDetails.filter((booking) => {
        const { availabilityInfo } = Utils.normalizeBookingTimes(booking);
        const { has24HoursPassedSinceBooking, isUpcomingSession } = availabilityInfo;

        const isMeetingDone = isMeetingCompleted(booking) || has24HoursPassedSinceBooking;

        switch (status) {
          case 'Upcoming':
            return (
              booking.status === BookedSession.confirmed &&
              !isMeetingDone &&
              isUpcomingSession
            );
          case 'Past':
            return isMeetingDone;
          case 'Canceled':
            return booking.status === BookedSession.canceled;
          default:
            return false;
        }
      });
    },
    [scheduledMeetingDetails, isMeetingCompleted]
  );

  const getCurrentTabBookings = useCallback(() => {
    return filterBookingsByStatus(activeTabs);
  }, [activeTabs, filterBookingsByStatus]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  return {
    // State
    scheduledMeetingDetails,
    isLoading,
    activeTabs,
    bIndex,
    bookedSession,

    // Setters
    setActiveTab,
    setBIndex,
    setBookedSession,

    // Actions
    fetchBookings,
    isMeetingCompleted,
    filterBookingsByStatus,
    getCurrentTabBookings,
  };
};
