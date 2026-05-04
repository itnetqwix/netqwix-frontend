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
                      className="chat-box notification notification-row-inner"
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "flex-start",
                        gap: "clamp(8px, 2vw, 12px)",
                        padding: "clamp(10px, 2vw, 14px) clamp(6px, 1.25vw, 10px)",
                        width: "100%",
                        boxSizing: "border-box",
                        borderBottom: "1px solid #eceff3",
                        cursor: "pointer",
                        transition: "background-color 0.2s ease",
                      }}
                      onClick={() => setSelectedNotification(notification)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f9fafb";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <div className="profile" style={{ 
                        position: "relative",
                        width: "clamp(40px, 10vw, 46px)",
                        height: "clamp(40px, 10vw, 46px)",
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
                          gap: "3px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "baseline",
                            justifyContent: "space-between",
                            gap: "8px",
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              fontSize: "clamp(11px, 2.8vw, 12px)",
                              fontWeight: 600,
                              color: "#4b5563",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              minWidth: 0,
                            }}
                          >
                            {getSenderName(notification)}
                          </span>
                          <h6
                            style={{
                              margin: 0,
                              fontSize: "clamp(10px, 2.6vw, 11px)",
                              fontWeight: 500,
                              color: "#94a3b8",
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            {Utils.formatTimeAgo(notification?.createdAt)}
                          </h6>
                        </div>
                        <h5
                          style={{
                            margin: 0,
                            fontSize: "clamp(13px, 3.2vw, 14px)",
                            fontWeight: 600,
                            color: "#1a1a1a",
                            lineHeight: 1.3,
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
                            fontSize: "clamp(11px, 2.8vw, 12px)",
                            color: "#6b7280",
                            lineHeight: 1.4,
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
              zIndex={10060}
              className="notification-detail-modal-dialog"
              modalClassName="notification-detail-modal-root"
              backdropClassName="notification-detail-modal-backdrop"
              contentClassName="notification-detail-modal-content"
              element={
                selectedNotification ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      width: "100%",
                      maxWidth: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        marginBottom: "10px",
                      }}
                    >
                      <button
                        type="button"
                        className="icon-btn btn-outline-light btn-sm close-panel"
                        onClick={() => setSelectedNotification(null)}
                        aria-label="Close notification details"
                        style={{
                          borderRadius: "999px",
                          padding: "8px",
                          lineHeight: 0,
                          background: "rgba(255,255,255,0.95)",
                          border: "1px solid #e2e8f0",
                          boxShadow: "0 4px 14px rgba(15,23,42,0.12)",
                        }}
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div
                      style={{
                        padding: "clamp(12px, 3vw, 18px)",
                        background: "#ffffff",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "clamp(10px, 2.5vw, 14px)",
                          marginBottom: "clamp(10px, 2.5vw, 14px)",
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            width: "clamp(44px, 11vw, 52px)",
                            height: "clamp(44px, 11vw, 52px)",
                            borderRadius: "50%",
                            overflow: "hidden",
                            flexShrink: 0,
                          }}
                        >
                          <ImageSkeleton
                            src={getNotificationImage(selectedNotification)}
                            alt={getSenderName(selectedNotification)}
                            fallbackSrc="/assets/images/contact/1.jpg"
                            lazy={true}
                            skeletonType="circular"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: "clamp(11px, 2.8vw, 12px)",
                              color: "#64748b",
                              fontWeight: 600,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {getSenderName(selectedNotification)}
                          </div>
                          <div
                            style={{
                              fontSize: "clamp(15px, 3.8vw, 17px)",
                              color: "#0f172a",
                              fontWeight: 700,
                              lineHeight: 1.25,
                              wordBreak: "break-word",
                            }}
                          >
                            {selectedNotification?.title || "Notification"}
                          </div>
                        </div>
                      </div>

                      {(selectedNotification?.image ||
                        selectedNotification?.thumbnail) && (
                        <div
                          style={{
                            marginBottom: "clamp(10px, 2.5vw, 14px)",
                            borderRadius: "10px",
                            overflow: "hidden",
                            border: "1px solid #e2e8f0",
                            background: "#f8fafc",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            maxHeight: "min(42vh, 280px)",
                          }}
                        >
                          <img
                            src={getNotificationImage(selectedNotification)}
                            alt={
                              selectedNotification?.title ||
                              "Notification image"
                            }
                            style={{
                              width: "100%",
                              height: "auto",
                              maxHeight: "min(42vh, 280px)",
                              objectFit: "contain",
                              display: "block",
                            }}
                          />
                        </div>
                      )}

                      <div
                        style={{
                          fontSize: "clamp(13px, 3.2vw, 14px)",
                          color: "#334155",
                          lineHeight: 1.55,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          marginBottom: "clamp(10px, 2.5vw, 14px)",
                        }}
                      >
                        {selectedNotification?.description ||
                          "No message available."}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "8px 12px",
                          borderTop: "1px solid #f1f5f9",
                          paddingTop: "clamp(10px, 2.5vw, 12px)",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "clamp(11px, 2.8vw, 12px)",
                            color: "#64748b",
                          }}
                        >
                          {Utils.formatTimeAgo(selectedNotification?.createdAt)}
                        </span>
                        <span
                          style={{
                            fontSize: "clamp(11px, 2.8vw, 12px)",
                            color: "#334155",
                            fontWeight: 600,
                          }}
                        >
                          {formatNotificationDateTime(
                            selectedNotification?.createdAt
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null
              }
            />
        </div>
    );
}

export default NotificationSection;