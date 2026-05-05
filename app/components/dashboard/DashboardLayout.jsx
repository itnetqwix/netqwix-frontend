import React, { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/router";
import LeftSide from "../../../containers/leftSidebar";
import { useAppDispatch, useAppSelector } from "../../store";
import { authState } from "../auth/auth.slice";
import {
  AccountType,
  LOCAL_STORAGE_KEYS,
} from "../../common/constants";
import {
  getMasterDataAsync,
  masterState,
} from "../master/master.slice";
import Header from "../Header";
import { useMediaQuery } from "../../hook/useMediaQuery";
import { WebPushRegister } from "../notifications-service/Notification";
import {
  getAllNotifications,
} from "../notifications-service/notification.slice";
import { getMeAsync } from "../auth/auth.slice";
import CircleLoader from "../../common/CircleLoader";
import NotificationPopup from "../notification-popup";

// One bootstrap per SPA session so navigating between `/dashboard/*` pages
// does not remount the loader (each page wraps its own DashboardLayout).
let dashboardBootstrapSessionDone = false;

// Shared hook to centralize dashboard data fetching and loading state
const useDashboardData = (dispatch, userInfo, masterStatus) => {
  const width1000 = useMediaQuery(1000);
  const [isBootstrapping, setIsBootstrapping] = useState(
    () => !dashboardBootstrapSessionDone
  );

  useEffect(() => {
    if (dashboardBootstrapSessionDone) {
      setIsBootstrapping(false);
      return;
    }

    WebPushRegister();
    const bootstrapStart = Date.now();
    const minLoaderMs = 450;

    const bootstrap = async () => {
      try {
        await dispatch(getMasterDataAsync());
      } finally {
        const elapsed = Date.now() - bootstrapStart;
        const remaining = Math.max(0, minLoaderMs - elapsed);
        setTimeout(() => {
          dashboardBootstrapSessionDone = true;
          setIsBootstrapping(false);
        }, remaining);
      }
    };
    bootstrap();

    setTimeout(() => {
      dispatch(getAllNotifications({ page: 1, limit: 20 }));
    }, 0);

    if (!userInfo || !userInfo._id) {
      dispatch(getMeAsync());
    }
  }, [dispatch, userInfo]);

  const hasToken =
    typeof window !== "undefined" &&
    !!localStorage.getItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN);
  const isUserInfoReady = !hasToken || (userInfo && userInfo._id);
  const isInitialDashboardLoading =
    isBootstrapping ||
    masterStatus === "pending" ||
    masterStatus === "idle" ||
    !isUserInfoReady;

  return {
    width1000,
    isInitialDashboardLoading,
  };
};

/**
 * DashboardLayout - Wrapper component for all dashboard routes
 * Provides consistent layout, sidebar, and data loading
 */
const DashboardLayout = ({ children }) => {
  const dispatch = useAppDispatch();
  const { userInfo } = useAppSelector(authState);
  const { status: masterStatus } = useAppSelector(masterState);
  const [openCloseToggleSideNav, setOpenCloseToggleSideNav] = React.useState(true);
  const router = useRouter();
  /** Match `containers/leftSidebar` (max-width: 452px) so main content clears the fixed rail. */
  const isCompactSidebarViewport = useMediaQuery(452);

  const { width1000, isInitialDashboardLoading } = useDashboardData(
    dispatch,
    userInfo,
    masterStatus
  );

  // Check if current route is meeting room (should not show header)
  const isMeetingRoom = router.pathname.includes('/meeting-room') || 
                        router.pathname.includes('/meeting');

  // Standalone `/dashboard/*` pages render here without `#get-navbar-tabs`; leftSidebar only
  // adjusts margins for that id + a few others, so content was sliding under the fixed nav.
  const dashboardMainStyle = React.useMemo(() => {
    const base = {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      minWidth: 0,
      minHeight: isCompactSidebarViewport ? "calc(100vh - 20px)" : "calc(100vh - 10px)",
      boxSizing: "border-box",
      transition: "margin-left 0.2s ease, width 0.2s ease, max-width 0.2s ease",
    };
    if (!openCloseToggleSideNav) {
      return { ...base, marginLeft: 0, width: "100%", maxWidth: "100%" };
    }
    if (isCompactSidebarViewport) {
      return {
        ...base,
        marginLeft: "65px",
        width: "calc(100vw - 65px)",
        maxWidth: "calc(100vw - 65px)",
      };
    }
    return {
      ...base,
      marginLeft: "105px",
      width: "calc(100vw - 105px)",
      maxWidth: "calc(100vw - 105px)",
    };
  }, [openCloseToggleSideNav, isCompactSidebarViewport]);

  return (
    <Fragment>
      {/* Socket is already provided at app level via SocketProvider in _app.jsx */}
      {!width1000 && !isMeetingRoom && <Header />}
      <div
        className={`chitchat-container sidebar-toggle ${
          userInfo?.account_type === AccountType.TRAINEE ? "" : ""
        }`}
        style={{
          marginTop:
            width1000 || isMeetingRoom
              ? "0px"
              : "80px",
        }}
      >
        <LeftSide
          setOpenCloseToggleSideNav={setOpenCloseToggleSideNav}
          openCloseToggleSideNav={openCloseToggleSideNav}
        />
        <div id="dashboard-layout-main" style={dashboardMainStyle}>
        {isInitialDashboardLoading ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              minHeight: "100%",
            }}
          >
            <CircleLoader size={40} />
            <p
              style={{
                margin: 0,
                color: "#64748b",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              Loading your dashboard...
            </p>
          </div>
        ) : (
          children
        )}
        </div>
      </div>
      <NotificationPopup />
    </Fragment>
  );
};

export default DashboardLayout;
