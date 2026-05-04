import { useContext, useEffect, useState, useRef } from "react";
import { Nav, NavLink, NavItem, TabContent, TabPane } from "reactstrap";

import "photoswipe/style.css";
import { useAppDispatch, useAppSelector } from "../../store";
import VideoUpload from "../../../app/components/videoupload";
import { useMediaQuery } from "usehooks-ts";
import { Utils } from "../../../utils/utils";
import { BRAND_FULL_LOGO_SRC, LOCAL_STORAGE_KEYS } from "../../common/constants";
import { getTraineeClips } from "../NavHomePage/navHomePage.api";
import Modal from "../../common/modal";
import { X } from "react-feather";
import StudentDetail from "../Header/StudentTab/StudentDetail";
import {
  getAllUsers,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriendRequests,
  removeFriend,
  getFriends,
  cancelFriendRequest,
} from "../../common/common.api";
import { toast } from "react-toastify";
import { authState } from "../auth/auth.slice";
import { MdPersonRemoveAlt1 } from "react-icons/md";
import { EVENTS } from "../../../helpers/events";
import { SocketContext } from "../socket";
import { notificiationTitles } from "../../../utils/constant";
import ConfirmModal from "../locker/my-clips/confirmModal";
import UploadClipCard from "../videoupload/UploadClipCard";
const MyCommunity = (props) => {
  const dispatch = useAppDispatch();
  const socket = useContext(SocketContext);
  const [friends, setFriends] = useState([]);
  const [searchData, setSearchData] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const { userInfo } = useAppSelector(authState);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStudentData, SetselectedStudentData] = useState({});
  const [recentStudentClips, setRecentStudentClips] = useState([]);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  // Use refs to prevent duplicate API calls when switching tabs
  const hasFetchedFriendsRef = useRef(false);
  const hasFetchedFriendRequestsRef = useRef(false);
  
  const getFriendsApi = async () => {
    try {
      let res = await getFriends();
      setFriends(res?.friends);
       
    } catch (error) {
       
    }
  };

  const getFriendRequestsApi = async () => {
    try {
      let res = await getFriendRequests();
      setFriendRequests(res?.friendRequests);
       
    } catch (error) {
       
    }
  };

  useEffect(() => {
    // Only fetch if not already fetched (prevents refetching when switching tabs)
    if (!hasFetchedFriendsRef.current) {
      hasFetchedFriendsRef.current = true;
      getFriendsApi();
    }
    if (!hasFetchedFriendRequestsRef.current) {
      hasFetchedFriendRequestsRef.current = true;
      getFriendRequestsApi();
    }
  }, []);

  const [activeTab, setActiveTab] = useState("friends");
  const [accountType, setAccountType] = useState("");

  const isMobileScreen = useMediaQuery("(max-width:1000px)");
  const [searchTerm, setSearchTerm] = useState("");
  useEffect(() => {
    setAccountType(localStorage.getItem(LOCAL_STORAGE_KEYS.ACC_TYPE));
  }, []);

  useEffect(() => {
    setActiveTab("friends");
  }, []);

  const handleCourseClick = (course, index, id) => {
    setIsOpen(true);
    getTraineeClipsApi(id);
  };

  const getTraineeClipsApi = async (id) => {
    try {
      let res = await getTraineeClips({ trainer_id: id });
      setRecentStudentClips(res?.data);
       
    } catch (error) {
       
    }
  };

  const sendNotifications = (data) => {
    socket?.emit(EVENTS.PUSH_NOTIFICATIONS.ON_SEND, data);
  };

  const handleSendFriendRequest = async (userId) => {
    try {
      await sendFriendRequest({ receiverId: userId });
      toast.success("Friend request sent");
      sendNotifications({
        title: notificiationTitles.friendRequestReceived,
        description: userInfo?.fullname + " sent you a friend request.",
        senderId: userInfo?._id,
        receiverId: userId,
      });
      setSearchData((prevData) =>
        prevData.map((user) =>
          user._id === userId ? { ...user, requestSent: true } : user
        )
      );
      getFriendRequestsApi();
    } catch (error) {
      toast.error(error);
    }
  };

  const handleAcceptFriendRequest = async (requestId) => {
    try {
      await acceptFriendRequest({ requestId });
      toast.success("Friend request accepted");
      setActiveTab("friends")
      getFriendRequestsApi();
      getFriendsApi()
    } catch (error) {
      toast.error(error);
    }
  };

  const handleCancelFriendRequest = async (requestId) => {
    try {
      await cancelFriendRequest({ receiverId: requestId });
       
      setSearchData((prevData) => {
        const data = prevData.map((user) =>
          user._id === requestId ? { ...user, requestSent: false } : user
        );
         
        return data;
      });
      toast.success("Friend request cancelled");
      getFriendRequestsApi();
    } catch (error) {
      toast.error(error);
    }
  };

  const handleRejectFriendRequest = async (requestId) => {
    try {
      await rejectFriendRequest({ requestId });
      toast.success("Friend request rejected");
      getFriendRequestsApi();
    } catch (error) {
      toast.error(error);
    }
  };

  const handleRemoveFriend = async (userId) => {
    try {
      await removeFriend({ friendId: userId });
      toast.success("Friend removed");
      getFriendsApi();
      setIsDeleteOpen(false);
    } catch (error) {
      toast.error(error);
    }
  };

  const isFriend = (userId) => {
    return friends.some((friend) => friend._id === userId);
  };

  const isRequestSent = (index) => {
    return searchData[index].friendRequests.some(
      (request) => request.senderId === userInfo._id
    );
  };

  const resolveProfileImage = (item) => Utils.getProfileImageSrc(item);

  if (userInfo?.status === "pending") {
    return (
      <div style={{ display: "flex", justifyContent: "center", marginTop: "32px" }}>
        <p style={{ textAlign: "center", color: "#9a6700", background: "#fff8e6", padding: "12px 16px", borderRadius: "10px", fontWeight: 500 }}>
          Please wait while the admin approves your request.
        </p>
      </div>
    );
  }

  if (userInfo?.status === "rejected") {
    return (
      <div style={{ display: "flex", justifyContent: "center", marginTop: "32px" }}>
        <p style={{ textAlign: "center", color: "#9f1239", background: "#fff1f2", padding: "12px 16px", borderRadius: "10px", fontWeight: 500 }}>
          Your account has been rejected by the admin. Please contact customer support.
        </p>
      </div>
    );
  }


  return (


    <div
      className={`apps-content `}
      style={{
        margin: !isMobileScreen ? "30px" : "15px",
        marginTop: isMobileScreen ? "0px" : "30px",
        background: "#ffffff",
        borderRadius: "16px",
        padding: isMobileScreen ? "14px" : "20px",
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
      }}
      id="files"
    >
      <ConfirmModal
        title="Remove friend?"
        closeModal={() => setIsDeleteOpen(false)}
        deleteFunc={handleRemoveFriend}
        isModelOpen={isDeleteOpen}
        message="This person will be removed from your friends list."
        selectedId={selectedId}
      />
      {!isMobileScreen && <h2 className="mb-2">My Community</h2>}
      <p style={{ color: "#6b7280", marginBottom: "14px", fontSize: "14px" }}>
        Manage your friends, requests, and quickly find people from the community.
      </p>
      <div>
        <form
          className={`form-inline`}
          onSubmit={async (e) => {
            e.preventDefault();
             
            const data = await getAllUsers({ search: searchTerm });
            setSearchData(data.result);

            setActiveTab("search");
             
          }}
        >
          <div
            className="form-group"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              padding: "8px",
            }}
          >
            <input
              className="form-control-plaintext"
              type="search"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flex: "1",
                border: "none",
                borderRadius: "10px",
                background: "transparent",
                padding: "8px 10px",
              }}
            />
            <button
              className="btn btn-primary btn-sm"
              style={{
                fontSize: isMobileScreen ? "revert-layer" : "12px",
                whiteSpace: "nowrap",
                borderRadius: "10px",
                padding: "8px 14px",
                fontWeight: 600,
              }}
              type="submit"
              disabled={!searchTerm.trim()}
            >
              Search
            </button>
          </div>
        </form>
      </div>
     
      <VideoUpload />
      <div className="theme-tab">
        <Nav tabs>
          <div
            className="row mb-2"
            style={{
              width: "100%",
              alignItems: "center",
              margin: "0px",
              gap: !isMobileScreen ? "20px" : "0px",
              background: "#f8fafc",
              borderRadius: "12px",
              padding: "8px",
            }}
          >
            <div className="col" style={{ padding: "0px", marginTop: "10px" }}>
              <NavItem className="ml-5px">
                <NavLink
                  className={`button-effect ${activeTab === "friends" ? "active" : ""
                    }`}
                  onClick={() => {
                    setActiveTab("friends");
                    getFriendsApi();
                  }}
                  style={{ width: "100%" }}
                >
                  Friends
                </NavLink>
              </NavItem>
            </div>
            <div
              className="col text-right"
              style={{
                padding: "0px",
                marginTop: "10px",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  zIndex: 2,
                  right: 5,
                  top: -5,
                  background: "#ef4444",
                  height: 20,
                  width: 20,
                  borderRadius: "100%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  color: "white",
                  fontWeight: "bold",
                  boxShadow: "0 2px 8px rgba(239, 68, 68, 0.35)",
                }}
              >
                {friendRequests.length}
              </div>
              <NavItem className="ml-5px">
                <NavLink
                  className={`button-effect ${activeTab === "pending-requests" ? "active" : ""
                    }`}
                  onClick={() => {
                    setActiveTab("pending-requests");
                    getFriendRequestsApi();
                  }}
                  style={{ width: "100%" }}
                >
                  Requests
                </NavLink>
              </NavItem>
            </div>
          </div>
        </Nav>
      </div>
      <div className="file-tab">
        <TabContent activeTab={activeTab} className="custom-scroll">
          <TabPane tabId="search">
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
                gap: "12px",
                marginTop: 10,
                width: "100%",
              }}
            >
              {searchData && searchData.length ? (
                searchData?.map((data, index) => {
                  return (
                    <div
                      style={{
                        cursor: "pointer",
                        border: "1px solid #dbe4ff",
                        borderRadius: "12px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        textAlign: "center",
                        gap: "8px",
                        padding: "12px 10px",
                        position: "relative",
                        background: "#ffffff",
                        boxShadow: "0 6px 18px rgba(15, 23, 42, 0.08)",
                        transition: "transform 0.2s ease, box-shadow 0.2s ease",
                        minHeight: "168px",
                      }}
                      onClick={() => {
                        if (isFriend(data?._id)) {
                          handleCourseClick(data, index, data?._id);
                          SetselectedStudentData({ ...data });
                        }
                      }}
                    >
                      <div>
                        <img
                          height={72}
                          width={72}
                          src={resolveProfileImage(data)}
                          alt=""
                          onError={(e) => {
                            e.target.src = "/assets/images/demoUser.png"; // Set default image on error
                          }}
                          style={{ borderRadius: "50%", objectFit: "cover" }}
                        />
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 5,
                          width: "100%",
                          minWidth: 0,
                        }}
                      >
                        <h5
                          style={{
                            margin: 0,
                            fontSize: "13px",
                            lineHeight: 1.25,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={data?.fullname}
                        >
                          <b>{data?.fullname}</b>
                        </h5>


                        {friendRequests.find((req) => req.senderId?._id === data?._id) ? (
                          (() => {
                            const request = friendRequests.find((req) => req.senderId?._id === data?._id);
                            return (
                              <div className="d-flex" style={{ gap: 5 }}>
                                <button
                                  style={{
                                    padding: 5,
                                    marginTop: 5,
                                    fontSize: isMobileScreen ? "revert-layer" : "12px",
                                  }}
                                  className="btn btn-success btn-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAcceptFriendRequest(request?._id); // ✅ Send request._id
                                  }}
                                >
                                  Accept
                                </button>
                                <button
                                  style={{
                                    padding: 5,
                                    marginTop: 5,
                                    fontSize: isMobileScreen ? "revert-layer" : "12px",
                                  }}
                                  className="btn btn-danger btn-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRejectFriendRequest(request?._id); // ✅ Send request._id
                                  }}
                                >
                                  Reject
                                </button>
                              </div>
                            );
                          })()
                        ) : isFriend(data?._id) ? (
                          <button
                            style={{
                              position: "absolute",
                              padding: 5,
                              top: 0,
                              backgroundColor: "red",
                              color: "white",
                              border: "none",
                              right: 0,
                              fontSize: isMobileScreen ? "revert-layer" : "12px",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(data?._id);
                              setIsDeleteOpen(true);
                            }}
                          >
                            <MdPersonRemoveAlt1 size={15} />
                          </button>
                        ) : isRequestSent(index) || data.requestSent ? (
                          <button
                            style={{
                              padding: 5,
                              width: 110,
                              marginTop: 5,
                              fontSize: isMobileScreen ? "revert-layer" : "12px",
                            }}
                            className="btn btn-danger btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelFriendRequest(data?._id);
                            }}
                          >
                            Cancel Request
                          </button>
                        ) : (
                          <button
                            style={{
                              padding: 5,
                              width: 110,
                              marginTop: 5,
                              fontSize: isMobileScreen ? "revert-layer" : "12px",
                            }}
                            className="btn btn-primary btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendFriendRequest(data?._id);
                            }}
                          >
                            Add Friend
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      marginTop: "40px",
                    }}
                  >
                    <h5 className="block-title" style={{ color: "#64748b" }}> No Friends Found</h5>
                  </div>
                </>
              )}
            </div>
          </TabPane>
          <TabPane tabId="friends">
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
                gap: "12px",
                marginTop: 10,
                width: "100%",
              }}
            >
              {friends && friends.length ? (
                friends?.map((data, index) => {
                  return (
                    <div
                      style={{
                        cursor: "pointer",
                        border: "1px solid #dbe4ff",
                        borderRadius: "12px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        textAlign: "center",
                        gap: "8px",
                        padding: "12px 10px",
                        position: "relative",
                        background: "#ffffff",
                        boxShadow: "0 6px 18px rgba(15, 23, 42, 0.08)",
                        minHeight: "148px",
                      }}
                      onClick={() => {
                        handleCourseClick(data, index, data?._id);
                        SetselectedStudentData({ ...data });
                      }}
                    >
                      <div>
                        <img
                          height={72}
                          width={72}
                          src={resolveProfileImage(data)}
                          alt=""
                          onError={(e) => {
                            e.target.src = "/assets/images/demoUser.png"; // Set default image on error
                          }}
                          style={{ borderRadius: "50%", objectFit: "cover" }}
                        />
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 5,
                          width: "100%",
                          minWidth: 0,
                        }}
                      >
                        <h5
                          style={{
                            margin: 0,
                            fontSize: "13px",
                            lineHeight: 1.25,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={data?.fullname}
                        >
                          <b>{data?.fullname}</b>
                        </h5>


                        <button
                          style={{
                            position: "absolute",
                            padding: 5,
                            top: 6,
                            backgroundColor: "red",
                            color: "white",
                            border: "none",
                            right: 6,
                            fontSize: isMobileScreen ? "revert-layer" : "12px",
                            borderRadius: 6,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(data?._id);
                            setIsDeleteOpen(true);
                          }}
                        >
                          <MdPersonRemoveAlt1 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      marginTop: "40px",
                    }}
                  >
                    <h5 className="block-title" style={{ color: "#64748b" }}> No Friends Found</h5>
                  </div>
                </>
              )}
            </div>
          </TabPane>
          <TabPane tabId="pending-requests">
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(min(100%, 160px), 1fr))",
                gap: "12px",
                marginTop: 10,
                width: "100%",
              }}
            >
              {friendRequests && friendRequests.length ? (
                friendRequests?.map((request, index) => (
                  <div
                    style={{
                      cursor: "pointer",
                      border: "1px solid #dbe4ff",
                      borderRadius: "12px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                      gap: "8px",
                      padding: "12px 10px",
                      background: "#ffffff",
                      boxShadow: "0 6px 18px rgba(15, 23, 42, 0.08)",
                      minHeight: "168px",
                    }}
                    key={index}
                  >
                    <div>
                      <img
                        height={72}
                        width={72}
                        src={resolveProfileImage(request?.senderId)}
                        alt=""
                        onError={(e) => {
                          e.target.src = "/assets/images/demoUser.png"; // Set default image on error
                        }}
                        style={{ borderRadius: "50%", objectFit: "cover" }}
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 5,
                        width: "100%",
                        minWidth: 0,
                      }}
                    >
                      <h5
                        style={{
                          margin: 0,
                          fontSize: "13px",
                          lineHeight: 1.25,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={request.senderId?.fullname}
                      >
                        <b>{request.senderId?.fullname}</b>
                      </h5>


                      <div
                        className="d-flex flex-wrap justify-content-center"
                        style={{ gap: 6 }}
                      >
                        <button
                          style={{
                            padding: "4px 8px",
                            fontSize: isMobileScreen ? "revert-layer" : "12px",
                          }}
                          className="btn btn-success btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAcceptFriendRequest(request?._id);
                          }}
                        >
                          Accept
                        </button>
                        <button
                          style={{
                            padding: "4px 8px",
                            fontSize: isMobileScreen ? "revert-layer" : "12px",
                          }}
                          className="btn btn-danger btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRejectFriendRequest(request?._id);
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      marginTop: "40px",
                    }}
                  >
                    <h5 className="block-title" style={{ color: "#64748b" }}> No Pending Requests</h5>
                  </div>
                </>
              )}
            </div>
          </TabPane>
        </TabContent>
      </div>

      <Modal
        isOpen={isOpen}
        element={
          <div className="container media-gallery portfolio-section grid-portfolio ">
            <div className="theme-title">
              <div className="media mb-4">
                <div
                  className="logo"
                  style={{
                    margin: isMobileScreen && "auto",
                  }}
                >
                  <img
                    src={BRAND_FULL_LOGO_SRC}
                    alt="NetQwix"
                    className="header-image-logo"
                    style={{
                      maxWidth: isMobileScreen ? "min(220px, 85vw)" : "min(320px, 40vw)",
                      width: "100%",
                      height: "auto",
                      objectFit: "contain",
                      margin: isMobileScreen ? "auto" : undefined,
                    }}
                  />
                  
                </div>
                
                <div className="media-body media-body text-right" style={{ flex: isMobileScreen ? "none" : "auto" }}>
                  <div
                    className="icon-btn btn-sm btn-outline-light close-apps pointer"
                    onClick={() => {
                      setIsOpen(false);
                    }}
                  >
                    {" "}
                    <X />{" "}
                  </div>
                </div>
              </div>
              <StudentDetail
                videoClips={recentStudentClips}
                data={selectedStudentData}
              />
            </div>
          </div>
        }
      />
    </div>
  );
};

export default MyCommunity;
