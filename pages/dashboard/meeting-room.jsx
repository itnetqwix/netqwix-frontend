import DashboardLayout from '../../app/components/dashboard/DashboardLayout';
import { useSetTab } from '../../app/hook/useSetTab';
import { topNavbarOptions } from '../../app/common/constants';
import MeetingRoomFeature from '../../app/features/meeting-room';

export default function DashboardMeetingRoomPage() {
  useSetTab(topNavbarOptions.MEETING_ROOM);
  return (
    <DashboardLayout>
      <MeetingRoomFeature />
    </DashboardLayout>
  );
}
