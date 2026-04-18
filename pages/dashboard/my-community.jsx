import DashboardLayout from '../../app/components/dashboard/DashboardLayout';
import { useSetTab } from '../../app/hook/useSetTab';
import { topNavbarOptions } from '../../app/common/constants';
import MyCommunity from '../../app/components/myCommunity';

export default function DashboardMyCommunityPage() {
  useSetTab(topNavbarOptions.MY_COMMUNITY);
  return (
    <DashboardLayout>
      <MyCommunity />
    </DashboardLayout>
  );
}
