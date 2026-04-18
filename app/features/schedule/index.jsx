import React from 'react';
import { useAppSelector } from '../../store';
import { authState } from '../../components/auth/auth.slice';
import { AccountType, LOCAL_STORAGE_KEYS } from '../../common/constants';
import { Bookings } from '../bookings';
import ScheduleInventory from '../../components/trainer/scheduleInventory';
import SchedulePage from '../../components/schedule/SchedulePage';

/**
 * ScheduleFeature
 * Trainer → weekly availability editor (SchedulePage).
 * Trainee → bookings list (Bookings).
 * Fallback → ScheduleInventory (admin / unknown role).
 *
 * Owns the account-type routing so the page file stays thin.
 */
export default function ScheduleFeature() {
  const { userInfo } = useAppSelector(authState);
  const accountType =
    userInfo?.account_type ||
    (typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEYS.ACC_TYPE) : null);

  if (accountType === AccountType.TRAINER) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', height: '100%', width: '100%' }}>
        <SchedulePage />
      </div>
    );
  }

  if (accountType === AccountType.TRAINEE) {
    return <Bookings accountType={accountType} />;
  }

  return <ScheduleInventory />;
}
