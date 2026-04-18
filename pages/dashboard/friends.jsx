import DashboardLayout from '../../app/components/dashboard/DashboardLayout';
import { useSetTab } from '../../app/hook/useSetTab';
import { topNavbarOptions } from '../../app/common/constants';
import StudentRecord from '../../app/components/Header/StudentTab/StudentRecord';

export default function DashboardFriendsPage() {
  useSetTab(topNavbarOptions.Friends);
  return (
    <DashboardLayout>
      <StudentRecord friends={true} />
    </DashboardLayout>
  );
}
