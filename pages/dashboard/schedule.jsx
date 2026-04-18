import DashboardLayout from '../../app/components/dashboard/DashboardLayout';
import { useSetTab } from '../../app/hook/useSetTab';
import { leftSideBarOptions } from '../../app/common/constants';
import ScheduleFeature from '../../app/features/schedule';

export default function DashboardSchedulePage() {
  useSetTab(leftSideBarOptions.SCHEDULE_TRAINING, 'sidebar');
  return (
    <DashboardLayout>
      <ScheduleFeature />
    </DashboardLayout>
  );
}
