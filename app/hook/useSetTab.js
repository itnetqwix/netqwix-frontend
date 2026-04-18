import { useEffect } from 'react';
import { useAppDispatch } from '../store';
import { authAction } from '../components/auth/auth.slice';

/**
 * Dispatches the appropriate tab-active action on mount.
 *
 * @param {string} tab - A value from `topNavbarOptions` or `leftSideBarOptions`
 * @param {'top'|'sidebar'} kind - Which nav the tab belongs to (default: 'top')
 */
export const useSetTab = (tab, kind = 'top') => {
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (!tab) return;
    if (kind === 'sidebar') {
      dispatch(authAction.setActiveTab(tab));
    } else {
      dispatch(authAction.setTopNavbarActiveTab(tab));
    }
  }, [dispatch, tab, kind]);
};
