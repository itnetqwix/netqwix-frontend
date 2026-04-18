import DashboardLayout from '../../app/components/dashboard/DashboardLayout';
import { useSetTab } from '../../app/hook/useSetTab';
import { topNavbarOptions } from '../../app/common/constants';
import StudentRecord from '../../app/components/Header/StudentTab/StudentRecord';

export default function DashboardStudentPage() {
  useSetTab(topNavbarOptions.STUDENT);
  return (
    <DashboardLayout>
      <StudentRecord />
    </DashboardLayout>
  );
}
