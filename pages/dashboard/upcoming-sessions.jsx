import DashboardLayout from '../../app/components/dashboard/DashboardLayout';
import { useSetTab } from '../../app/hook/useSetTab';
import { topNavbarOptions } from '../../app/common/constants';
import { UpcomingSession } from '../../app/features/bookings';

export default function DashboardUpcomingSessionsPage() {
  useSetTab(topNavbarOptions.UPCOMING_SESSION);
  return (
    <DashboardLayout>
      <UpcomingSession />
    </DashboardLayout>
  );
}
