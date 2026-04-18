import DashboardLayout from '../../app/components/dashboard/DashboardLayout';
import { useSetTab } from '../../app/hook/useSetTab';
import { topNavbarOptions } from '../../app/common/constants';
import PracticeLiveExperience from '../../app/components/practiceLiveExperience';

export default function DashboardPracticeSessionPage() {
  useSetTab(topNavbarOptions.PRACTICE_SESSION);
  return (
    <DashboardLayout>
      <PracticeLiveExperience />
    </DashboardLayout>
  );
}
