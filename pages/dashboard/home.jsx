import DashboardLayout from '../../app/components/dashboard/DashboardLayout';
import { useSetTab } from '../../app/hook/useSetTab';
import { topNavbarOptions } from '../../app/common/constants';
import NavHomePage from '../../app/components/NavHomePage';

export default function DashboardHomePage() {
  useSetTab(topNavbarOptions.HOME);
  return (
    <DashboardLayout>
      <div id="get-navbar-tabs" className="get-navbar-tabs" style={{ overflow: 'hidden', height: '100%' }}>
        <NavHomePage />
      </div>
    </DashboardLayout>
  );
}
