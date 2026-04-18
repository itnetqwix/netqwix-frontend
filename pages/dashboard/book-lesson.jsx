import DashboardLayout from '../../app/components/dashboard/DashboardLayout';
import { useSetTab } from '../../app/hook/useSetTab';
import { topNavbarOptions } from '../../app/common/constants';
import BookLessonFeature from '../../app/features/book-lesson';

export default function DashboardBookLessonPage() {
  useSetTab(topNavbarOptions.BOOK_LESSON);
  return (
    <DashboardLayout>
      <BookLessonFeature />
    </DashboardLayout>
  );
}
