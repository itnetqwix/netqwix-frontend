import DashboardLayout from '../../app/components/dashboard/DashboardLayout';
import { useSetTab } from '../../app/hook/useSetTab';
import { leftSideBarOptions } from '../../app/common/constants';
import ChitChat from '../../containers/chatBoard';
import RightSide from '../../containers/rightSidebar';

export default function DashboardChatsPage() {
  useSetTab(leftSideBarOptions.CHATS, 'sidebar');
  return (
    <DashboardLayout>
      <ChitChat />
      <RightSide />
    </DashboardLayout>
  );
}
