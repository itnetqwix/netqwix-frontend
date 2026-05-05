import React, { useEffect, useState } from "react";
import axios from "axios";
import { useAppDispatch } from "../../store";
import { authState } from "../auth/auth.slice";
import { AccountType, LOCAL_STORAGE_KEYS } from "../../common/constants";
import {
  getRecentStudent,
  getRecentTrainers,
  getTraineeClips,
} from "../NavHomePage/navHomePage.api";
import Modal from "../../common/modal";
import { X } from "react-feather";
import StudentDetail from "../Header/StudentTab/StudentDetail";
import { Utils } from "../../../utils/utils";
import { useMediaQuery } from "../../hook/useMediaQuery";
import BookingTable from "../trainee/scheduleTraining/BookingTable.jsx";
import { TrainerDetails } from "../trainer/trainerDetails.jsx";
import { getTraineeWithSlotsAsync } from "../trainee/trainee.slice";
import RecentUsersSkeleton from "../common/RecentUsersSkeleton";
import ImageSkeleton from "../common/ImageSkeleton";

// const placeholderImageUrl = '/assets/images/avtar/user.png'; // Placeholder image path
const placeholderImageUrl = "/assets/images/demoUser.png"; // Placeholder image path

// Array.from({ length: 10 }, () => placeholderImageUrl)

const RecentUsers = ({ onTraineeSelect, hideOuterCard = false }) => {
  const [accountType, setAccountType] = useState("");
  const [recentStudent, setRecentStudent] = useState([]);
  const [recentTrainer, setRecentTrainer] = useState([]);

  const [recentFriends, setRecentFriends] = useState(
    Array.from({ length: 5 }, () => placeholderImageUrl)
  );
  const [recentStudentClips, setRecentStudentClips] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStudentData, SetselectedStudentData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const width600 = useMediaQuery(600);
  const width900 = useMediaQuery(900);

  useEffect(() => {
    getRecentStudentApi();
    getRecentTrainerApi();
    setAccountType(localStorage.getItem(LOCAL_STORAGE_KEYS?.ACC_TYPE));
  }, []);

  const getRecentStudentApi = async () => {
    try {
      setIsLoading(true);
      let res = await getRecentStudent();
      // API returns { status: "SUCCESS", data: [...] }
      // axiosInstance returns response.data, so res is { status: "SUCCESS", data: [...] }
      // We need to access res.data to get the array
      const students = (res?.data && Array.isArray(res.data)) ? res.data : (Array.isArray(res) ? res : []);
      setRecentStudent(students);
    } catch (error) {
      console.error("Error fetching recent students:", error);
      setRecentStudent([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getRecentTrainerApi = async () => {
    try {
      setIsLoading(true);
      let res = await getRecentTrainers();
      setRecentTrainer(res?.data || []);
    } catch (error) {
      console.error("Error fetching recent trainers:", error);
      setRecentTrainer([]);
    } finally {
      setIsLoading(false);
    }
  };
  const getTraineeClipsApi = async (id) => {
    try {
      let res = await getTraineeClips({ trainer_id: id });
      setRecentStudentClips(res?.data);
    } catch (error) {
       
    }
  };
  const handleStudentClick = (id) => {
    setRecentStudentClips(null);
    setIsOpen(true);
    getTraineeClipsApi(id);
  };

  const handleCloseModal = () => {
    setIsOpen(false);
    setRecentStudentClips(null);
  };

  const [startDate, setStartDate] = useState(new Date());
  const [activeTrainer, setActiveTrainer] = useState([]);
  const [getParams, setParams] = useState("");
  const [query, setQuery] = useState("");
  const [trainer, setTrainer] = useState({ trainer_id: "" });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(null);
  const [selectedTrainer, setSelectedTrainer] = useState({
    id: null,
    trainer_id: null,
    data: {},
  });
  const [trainerInfo, setTrainerInfo] = useState({
    userInfo: null,
    selected_category: null,
  });
  const [categoryList, setCategoryList] = useState([]);
  const dispatch = useAppDispatch()

  // Responsive helpers
  const getImageSize = () => {
    if (width600) return { width: "65px", height: "65px" };
    if (width900) return { width: "75px", height: "75px" };
    return { width: "80px", height: "80px" };
  };

  const imageSize = getImageSize();

  // Get the current list based on account type
  const currentList = accountType === AccountType?.TRAINER ? recentStudent : recentTrainer;

  return (
    <>
      <style>{`
        .recent-users-container {
          width: 100%;
          display: flex;
          flex-direction: column;
        }

        .recent-users-box {
          background-color: transparent;
          border-radius: 0;
          border: none;
          box-shadow: none;
          padding: 0 8px 10px 8px;
          position: relative;
          display: flex;
          flex-direction: column;
          flex: 1;
          overflow-y: auto;
          max-height: 100%;
          -webkit-overflow-scrolling: touch;
        }

        .recent-users-grid {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
          box-sizing: border-box;
          padding-top: 0;
        }

        .recent-users-item {
          display: flex;
          flex-direction: row;
          justify-content: flex-start;
          align-items: center;
          text-align: left;
          cursor: pointer;
          padding: 10px 12px;
          border-radius: 10px;
          transition: all 0.3s ease;
          background-color: #fafafa;
          border: 1px solid #f0f0f0;
          min-height: 86px;
          width: 100%;
          gap: 12px;
        }

        .recent-users-grid.single-row-experts {
          flex-direction: row;
          flex-wrap: nowrap;
          overflow-x: auto;
          overflow-y: hidden;
          gap: 14px;
          padding-bottom: 6px;
          padding-top: 4px;
          -webkit-overflow-scrolling: touch;
          scroll-behavior: smooth;
        }

        .recent-users-grid.single-row-experts .recent-users-item {
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          min-width: 130px;
          max-width: 150px;
          flex: 0 0 auto;
          min-height: 145px;
          padding: 10px 8px;
          gap: 8px;
        }

        .recent-users-grid.single-row-experts .recent-users-avatar {
          margin-bottom: 6px;
        }

        .recent-users-grid.single-row-experts .recent-users-name {
          max-width: 100%;
          width: 100%;
          text-align: center;
          padding: 0 2px;
        }

        .recent-users-item:hover {
          background-color: #f5f5f5;
          transform: translateY(-4px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
          border-color: #000080;
        }

        .recent-users-avatar {
          border-radius: 8px;
          border: 3px solid rgb(0, 0, 128);
          padding: 2px;
          margin-bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background-color: #fff;
          box-sizing: border-box;
          flex-shrink: 0;
          aspect-ratio: 1 / 1;
        }

        .recent-users-avatar img {
          width: 100%;
          height: 100%;
          border-radius: 6px;
          object-fit: cover;
          object-position: center;
          display: block;
          transition: opacity 0.3s ease;
        }

        .recent-users-avatar img.loaded {
          opacity: 1;
        }

        .recent-users-avatar img.loading {
          opacity: 0;
        }

        .recent-users-skeleton {
          width: 100%;
          height: 100%;
          border-radius: 6px;
          background: linear-gradient(
            90deg,
            #f0f0f0 25%,
            #e0e0e0 50%,
            #f0f0f0 75%
          );
          background-size: 200% 100%;
          animation: skeleton-loading 1.5s ease-in-out infinite;
          position: absolute;
          top: 0;
          left: 0;
        }

        @keyframes skeleton-loading {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }

        .recent-users-avatar-wrapper {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .recent-users-name {
          max-width: calc(100% - 90px);
          margin-bottom: 0;
          font-weight: 500;
          color: #333;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          width: auto;
          padding: 0;
          line-height: 1.3;
        }

        .recent-users-empty {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 40px 20px;
          color: #999;
          font-size: 14px;
          text-align: center;
        }

        /* Mobile */
        @media (max-width: 600px) {
          .recent-users-box {
            padding: 0 6px 8px 6px;
          }

          .recent-users-item {
            min-height: 76px;
            padding: 8px 10px;
            gap: 10px;
          }

          .recent-users-name {
            font-size: 12px;
            max-width: calc(100% - 75px);
          }

          .recent-users-grid.single-row-experts .recent-users-item {
            min-width: 110px;
            max-width: 130px;
            min-height: 130px;
            padding: 8px 6px;
          }
        }

        /* Tablet */
        @media (min-width: 601px) and (max-width: 900px) {
          .recent-users-item {
            min-height: 82px;
          }
        }

        /* Desktop */
        @media (min-width: 901px) {
        }
      `}</style>
      <div
        className={hideOuterCard ? "" : "card rounded trainer-profile-card Select Recent Student"}
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "visible",
          ...(hideOuterCard
            ? { border: "none", boxShadow: "none", background: "transparent" }
            : {}),
        }}
      >
      {trainerInfo && trainerInfo.userInfo ? (
        <Modal
          className="recent-user-modal"
          isOpen={isModalOpen}
          allowFullWidth={true}
          element={
            <TrainerDetails
              selectOption={trainerInfo}
              isPopoverOpen={isPopoverOpen}
              categoryList={categoryList}
              key={`trainerDetails`}
              searchQuery={query}
              trainerInfo={trainerInfo?.userInfo}
              selectTrainer={(_id, trainer_id, data) => {
                if (_id) {
                  setSelectedTrainer({
                    ...selectedTrainer,
                    id: _id,
                    trainer_id,
                    data,
                  });
                }
                setTrainerInfo((pre) => {
                  return {
                    ...pre,
                    userInfo: {
                      ...pre?.userInfo,
                      ...data,
                    },
                  };
                });
              }}
              onClose={() => {
                setTrainerInfo((prev) => ({
                  ...prev,
                  userInfo: undefined,
                  selected_category: undefined,
                }));
                setParams((prev) => ({
                  ...prev,
                  search: null,
                }));
                setIsModalOpen(false);
              }}
              isUserOnline={true}
              element={
                <BookingTable
                  selectedTrainer={selectedTrainer}
                  trainerInfo={trainerInfo}
                  setStartDate={setStartDate}
                  startDate={startDate}
                  getParams={getParams}
                  isUserOnline={true}
                />
              }
            />
          }
        />
      ) : (
        <></>
      )}
      <h2
        className="Recent-Heading"
        style={{ 
          textAlign: "center", 
          fontSize: width600 ? "18px" : "20px",
          fontWeight: "600",
          color: "#333",
          marginBottom: width600 ? "10px" : "15px",
          paddingTop: width600 ? "12px" : "15px",
          paddingLeft: "0",
          paddingRight: "0",
          display: "block",
          width: "100%",
          boxSizing: "border-box"
        }}
      >
        Recent {accountType === AccountType?.TRAINER ? "Students" : "Experts"}
      </h2>
      <div
        className="card-body Recent"
        style={{
          width: "100%",
          marginTop: "0px",
          padding: width600 ? "8px 6px" : "12px 10px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          flex: "1"
        }}
      >
        <div className="recent-users-container">
          {isLoading ? (
            <RecentUsersSkeleton />
          ) : (
          <div className="recent-users-box">
          {currentList && currentList.length > 0 ? (
            <div className={`recent-users-grid ${accountType !== AccountType?.TRAINER ? "single-row-experts" : ""}`}>
              {currentList.map((item, index) => (
                <div
                  key={item?._id || item?.id || index}
                  className="recent-users-item"
                  onClick={() => {
                    if (accountType === AccountType?.TRAINER) {
                      const traineeId = item?._id || item?.id;
                      if (onTraineeSelect) {
                        onTraineeSelect(traineeId);
                      }
                      handleStudentClick(traineeId);
                      SetselectedStudentData({ ...item });
                    } else {
                      setTrainerInfo((prev) => ({
                        ...prev,
                        userInfo: item,
                        selected_category: null,
                      }));
                      setSelectedTrainer({
                        id: item?.id || item?._id,
                        trainer_id: item?.id || item?._id,
                        data: item,
                      });
                      dispatch(getTraineeWithSlotsAsync({ search: item?.fullname || item?.fullName }));
                      setIsModalOpen(true);
                    }
                  }}
                >
                  <div
                    className="recent-users-avatar"
                    style={{
                      width: imageSize.width,
                      height: imageSize.height,
                    }}
                  >
                    <div className="recent-users-avatar-wrapper">
                      <ImageSkeleton
                        src={Utils.getProfileImageSrc(item)}
                        alt={accountType === AccountType?.TRAINER ? `Recent Student ${index + 1}` : `Recent Expert ${index + 1}`}
                        fallbackSrc="/assets/images/demoUser.png"
                        lazy={index > 3}
                        priority={index <= 3}
                        skeletonType="square"
                        style={{
                          width: "100%",
                          height: "100%",
                          borderRadius: "6px",
                          objectFit: "cover",
                          objectPosition: "center",
                          display: "block",
                        }}
                      />
                    </div>
                  </div>
                  <h5
                    className="recent-users-name"
                    style={{
                      fontSize: width600 ? "12px" : "13px",
                    }}
                  >
                    {item?.fullname || item?.fullName || 'Unknown'}
                  </h5>
                </div>
              ))}
            </div>
          ) : (
            <div className="recent-users-empty">
              No recent {accountType === AccountType?.TRAINER ? "students" : "experts"} found
            </div>
          )}
        </div>
          )}
        </div>
      </div>
      {accountType === AccountType?.TRAINER && (
        <Modal
          isOpen={isOpen}
          element={
            <div className="container media-gallery portfolio-section grid-portfolio ">
              <div className="theme-title">
                <div className="media">
                  <div className="media-body media-body text-right">
                    <div
                      className="icon-btn btn-sm btn-outline-light close-apps pointer"
                      onClick={handleCloseModal}
                    >
                      <X />
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
      )}
    </div>
    </>
  );
};

export default RecentUsers;
