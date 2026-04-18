import DashboardLayout from '../../app/components/dashboard/DashboardLayout';
import { useSetTab } from '../../app/hook/useSetTab';
import { topNavbarOptions } from '../../app/common/constants';
import ContactUs from '../../app/components/contactUs';

export default function DashboardContactUsPage() {
  useSetTab(topNavbarOptions.CONTACT_US);
  return (
    <DashboardLayout>
      <ContactUs />
    </DashboardLayout>
  );
}
