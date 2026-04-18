import DashboardLayout from '../../app/components/dashboard/DashboardLayout';
import { useSetTab } from '../../app/hook/useSetTab';
import { topNavbarOptions } from '../../app/common/constants';
import AboutUs from '../../app/components/aboutUs';

export default function DashboardAboutUsPage() {
  useSetTab(topNavbarOptions.ABOUT_US);
  return (
    <DashboardLayout>
      <AboutUs />
    </DashboardLayout>
  );
}
