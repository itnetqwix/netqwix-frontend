import Link from "next/link";
import {X} from "react-feather"
import { useAppDispatch, useAppSelector } from "../../app/store";
import { getAllNotifications, notificationState ,  updateNotificationsStatus } from "../../app/components/notifications-service/notification.slice";
import {  useEffect, useState, useRef } from "react";
import { Utils } from "../../utils/utils";
import { authState } from "../../app/components/auth/auth.slice";
import { debounce } from "lodash";
import ImageSkeleton from "../../app/components/common/ImageSkeleton";
import Modal from "../../app/common/modal";

const NOTIFICATION_LIMIT = 1000000000; // Load all notifications at once

const NotificationSection = (props) => {
    const dispatch = useAppDispatch();
    const {sidebarModalActiveTab} = useAppSelector(authState);
    const [page , setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const {notifications , isLoading, hasMoreNotifications} = useAppSelector(notificationState);
    const scrollContainerRef = useRef(null);
    const isInitialLoadRef = useRef(false);
    const [selectedNotification, setSelectedNotification] = useState(null);
    
    // Debounced scroll handler to prevent multiple API calls
    const handleScrollRef = useRef(null);
    
    useEffect(() => {
      // Create debounced function that has access to latest state
      handleScrollRef.current = debounce(() => {
        const ulElement = scrollContainerRef.current || document.querySelector('.notification-tab .chat-main') || document.querySelector('.notification-tab');
        if (!ulElement) return;
        
        // Get current state values
        const currentIsLoading = isLoading;
        const currentHasMore = hasMoreNotifications !== undefined ? hasMoreNotifications : hasMore;
        const currentPage = page;
        
        if (currentIsLoading || !currentHasMore) return;
        
        // Check if user scrolled near bottom (within 100px)
        const scrollTop = ulElement.scrollTop;
        const scrollHeight = ulElement.scrollHeight;
        const clientHeight = ulElement.clientHeight;
        const threshold = 100; // Load more when 100px from bottom
        
        if (scrollTop + clientHeight >= scrollHeight - threshold) {
          const nextPage = currentPage + 1;
          setPage(nextPage);
          dispatch(getAllNotifications({ page: nextPage, limit: NOTIFICATION_LIMIT, append: true }));
        }
      }, 300); // 300ms debounce
      
      return () => {
        if (handleScrollRef.current) {
          handleScrollRef.current.cancel();
        }
      };
    }, [isLoading, hasMoreNotifications, hasMore, page, dispatch]);

    useEffect(() => {
      // Wait for the element to be available in DOM
      const findScrollElement = () => {
        return scrollContainerRef.current || 
               document.querySelector('.notification-tab.active .chat-main') ||
               document.querySelector('.notification-tab .chat-main') ||
               document.querySelector('.notification-tab.active');
      };
      
      const ulElement = findScrollElement();
      if (!ulElement || !handleScrollRef.current) {
        // Retry after a short delay if element not found
        const timeoutId = setTimeout(() => {
          const retryElement = findScrollElement();
          if (retryElement && handleScrollRef.current) {
            retryElement.addEventListener('scroll', () => {
              if (handleScrollRef.current) handleScrollRef.current();
            }, { passive: true });
          }
        }, 100);
        return () => clearTimeout(timeoutId);
      }
      
      const scrollHandler = () => {
        if (handleScrollRef.current) {
          handleScrollRef.current();
        }
      };
      
      ulElement.addEventListener('scroll', scrollHandler, { passive: true });
      
      return () => {
        ulElement.removeEventListener('scroll', scrollHandler);
        if (handleScrollRef.current) {
          handleScrollRef.current.cancel();
        }
      };
    }, [isLoading, hasMoreNotifications, hasMore, page, sidebarModalActiveTab]);

    const closeLeftSide = () => {
      document.querySelector(".notification-tab").classList.remove("active")
      document.querySelector(".recent-default").classList.add("active");
      props.ActiveTab("")
    }
    
    // Initial load when notification tab is opened
    useEffect(() => {
      if(sidebarModalActiveTab === "notification" && !isInitialLoadRef.current){
        isInitialLoadRef.current = true;
        setPage(1);
        setHasMore(true);
        // Reset scroll position when opening
        setTimeout(() => {
          const scrollElement = scrollContainerRef.current || document.querySelector('.notification-tab.active .chat-main');
          if (scrollElement) {
            scrollElement.scrollTop = 0;
          }
        }, 100);
        dispatch(getAllNotifications({page: 1, limit: NOTIFICATION_LIMIT, append: false}));
        dispatch(updateNotificationsStatus({page: 1}));
      } else if(sidebarModalActiveTab !== "notification") {
        isInitialLoadRef.current = false;
        // Reset page when tab is closed
        setPage(1);
      }
    }, [sidebarModalActiveTab, dispatch]);
    
    // Update hasMore based on Redux state
    useEffect(() => {
      if (hasMoreNotifications !== undefined) {
        setHasMore(hasMoreNotifications);
      }
    }, [hasMoreNotifications]);

    
    const getSenderName = (notification) => {
      return (
        notification?.sender?.fullname ||
        notification?.sender?.name ||
        notification?.sender_name ||
        "NetQwix"
      );
    };

    const getNotificationImage = (notification) => {
      return (
        Utils?.getImageUrlOfS3(notification?.image) ||
        Utils?.getImageUrlOfS3(notification?.thumbnail) ||
        Utils?.getImageUrlOfS3(notification?.sender?.profile_picture) ||
        "/assets/images/contact/1.jpg"
      );
    };

    const formatNotificationDateTime = (dateValue) => {
      if (!dateValue) return "";
      const dateObj = new Date(dateValue);
      if (Number.isNaN(dateObj.getTime())) return "";
      return dateObj.toLocaleString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    return (
        <div className={`notification-tab dynemic-sidebar ${props.tab === "notification" ? "active" : ""} notificationClass`} id="notification">
            <div className="theme-title">
              <div className="media">
                <div> 
                  <h2>Notifications</h2>
                  {/* <h4>List of notification</h4> */}
                </div>
                <div className="media-body text-right">   <Link className="icon-btn btn-outline-light btn-sm close-panel" href="#" onClick={() => props.smallSideBarToggle()}><X/></Link></div>
              </div>
            </div>
            <ul className="chat-main custom-scroll" ref={scrollContainerRef}>
            {notifications && notifications.length > 0 ? (
              notifications.map((notification) => {
                return (
                  <li key={notification?._id}>
                    <div
                      className="chat-box notification"
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: "12px",
                        padding: "12px",
                        position: "relative",
                        width: "100%",
                        boxSizing: "border-box",
                        borderBottom: "1px solid #eceff3",
                        borderRadius: "10px",
                        cursor: "pointer",
                        transition: "background-color 0.2s ease, transform 0.1s ease",
                      }}
                      onClick={() => setSelectedNotification(notification)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f9fafb";
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      <div className="profile" style={{ 
                        position: "relative",
                        width: "46px",
                        height: "46px",
                        borderRadius: "50%",
                        overflow: "hidden",
                        flexShrink: 0,
                      }}>
                        <ImageSkeleton
                          src={getNotificationImage(notification)}
                          alt={getSenderName(notification)}
                          fallbackSrc="/assets/images/contact/1.jpg"
                          lazy={true}
                          skeletonType="circular"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                      </div>
                      <div
                        className="details"
                        style={{
                          flex: 1,
                          minWidth: 0,
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                          paddingRight: "76px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "#4b5563",
                            marginBottom: "0px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {getSenderName(notification)}
                        </span>
                        <h5
                          style={{
                            margin: 0,
                            fontSize: "14px",
                            fontWeight: 600,
                            color: "#1a1a1a",
                            lineHeight: "1.3",
                            marginBottom: "2px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {notification?.title}
                        </h5>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "12px",
                            color: "#6b7280",
                            lineHeight: "1.4",
                            wordWrap: "break-word",
                            overflowWrap: "break-word",
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            whiteSpace: "normal",
                          }}
                        >
                          {notification?.description}
                        </p>
                        <span style={{ fontSize: "11px", color: "#000080", fontWeight: 600 }}>
                          Tap to view details
                        </span>
                      </div>
                      <div
                        className="date-status"
                        style={{
                          position: "absolute",
                          top: "12px",
                          right: "12px",
                          flexShrink: 0,
                          textAlign: "right",
                        }}
                      >
                        <h6
                          style={{
                            margin: 0,
                            fontSize: "11px",
                            fontWeight: 500,
                            color: "#999",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {Utils.formatTimeAgo(notification?.createdAt)}
                        </h6>
                      </div>
                    </div>
                  </li>
                );
              })
            ) : (
              !isLoading && (
                <li style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                  No notifications found
                </li>
              )
            )}
            {isLoading && (
              <li style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                Loading more notifications...
              </li>
            )}
            {!hasMore && notifications && notifications.length > 0 && (
              <li style={{ textAlign: 'center', padding: '20px', color: '#666', fontSize: '12px' }}>
                No more notifications to load
              </li>
            )}
            </ul>

            <Modal
              isOpen={Boolean(selectedNotification)}
              toggle={() => setSelectedNotification(null)}
              scrollableBody={true}
              element={
                <div style={{ padding: "8px 6px 4px 6px" }}>
                  <div className="theme-title" style={{ marginBottom: "10px" }}>
                    <div className="media">
                      <div>
                        <h2 style={{ marginBottom: 0 }}>Notification Details</h2>
                      </div>
                      <div className="media-body text-right">
                        <button
                          type="button"
                          className="icon-btn btn-outline-light btn-sm close-panel"
                          onClick={() => setSelectedNotification(null)}
                          aria-label="Close notification details"
                        >
                          <X />
                        </button>
                      </div>
                    </div>
                  </div>

                  {selectedNotification && (
                    <div
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "12px",
                        padding: "14px",
                        background: "#ffffff",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                        <div style={{ width: "52px", height: "52px", borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
                          <ImageSkeleton
                            src={getNotificationImage(selectedNotification)}
                            alt={getSenderName(selectedNotification)}
                            fallbackSrc="/assets/images/contact/1.jpg"
                            lazy={true}
                            skeletonType="circular"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: 600 }}>
                            {getSenderName(selectedNotification)}
                          </div>
                          <div style={{ fontSize: "16px", color: "#111827", fontWeight: 700, lineHeight: 1.3 }}>
                            {selectedNotification?.title || "Notification"}
                          </div>
                        </div>
                      </div>

                      {(selectedNotification?.image || selectedNotification?.thumbnail) && (
                        <div style={{ marginBottom: "12px", borderRadius: "10px", overflow: "hidden", border: "1px solid #e5e7eb" }}>
                          <img
                            src={getNotificationImage(selectedNotification)}
                            alt={selectedNotification?.title || "Notification image"}
                            style={{ width: "100%", maxHeight: "240px", objectFit: "cover", display: "block" }}
                          />
                        </div>
                      )}

                      <div
                        style={{
                          fontSize: "14px",
                          color: "#374151",
                          lineHeight: 1.6,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          marginBottom: "12px",
                        }}
                      >
                        {selectedNotification?.description || "No message available."}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          borderTop: "1px solid #f3f4f6",
                          paddingTop: "10px",
                          gap: "12px",
                          flexWrap: "wrap",
                        }}
                      >
                        <span style={{ fontSize: "12px", color: "#6b7280" }}>
                          {Utils.formatTimeAgo(selectedNotification?.createdAt)}
                        </span>
                        <span style={{ fontSize: "12px", color: "#374151", fontWeight: 600 }}>
                          {formatNotificationDateTime(selectedNotification?.createdAt)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              }
            />
        </div>
    );
}

export default NotificationSection;