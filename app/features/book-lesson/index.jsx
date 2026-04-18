import React from 'react';
import { useAppSelector } from '../../store';
import { authState } from '../../components/auth/auth.slice';
import { AccountType, LOCAL_STORAGE_KEYS } from '../../common/constants';
import TraineeDashboardContainer from '../../components/trainee/dashboard';
import TrainerDashboardContainer from '../../components/trainer/dashboard';

/**
 * BookLessonFeature
 * Renders the correct dashboard (trainer or trainee) based on account type.
 * Owns the account-type resolution so the page file stays thin.
 */
export default function BookLessonFeature() {
  const { userInfo } = useAppSelector(authState);
  const accountType =
    userInfo?.account_type ||
    (typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEYS.ACC_TYPE) : null);

  if (accountType === AccountType.TRAINEE) {
    return (
      <div id="get-dashboard" className="get-dashboard">
        <TraineeDashboardContainer openCloseToggleSideNav={true} />
      </div>
    );
  }

  if (accountType === AccountType.TRAINER) {
    return (
      <div id="get-dashboard" className="get-dashboard">
        <TrainerDashboardContainer accountType={accountType} />
      </div>
    );
  }

  return null;
}
