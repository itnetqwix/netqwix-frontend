import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  addRating,
  addTraineeClipInBookedSession,
  getScheduledMeetingDetails,
  updateBookedSessionScheduledMeeting,
  uploadProfilePicture,
} from "./common.api";
import { toast } from "react-toastify";
import {
  toastErrorOpts,
  toastSuccessOpts,
} from "../../common/toastDefaults";

const initialState = {
  status: "idle",
  scheduledMeetingDetails: [],
  scheduledMeetingDetailsByStatus: {
    upcoming: [],
    cancelled: [],
    completed: [],
    active: [],
  },
  addRatingModel: { _id: null, isOpen: false },
  profile_picture: null,
  isLoading: true,
  selectedTrainerId: null,
  profile_image_url: null,
  configs: {
    sidebar: {
      isToggleEnable: false,
      isMobileMode: false,
    },
  },
  activeTab: "",
  sidebarTab: "",
  isMeetingLoading : false,
  startMeeting : {
    trainerInfo: null,
    traineeInfo: null,
    id: null,
    isOpenModal: false,
  },
  // Cache metadata to prevent unnecessary refetches
  lastFetchedTimestamp: {},
  cachedTabBook: null,
};

export const addRatingAsync = createAsyncThunk(
  "add/rating",
  async (payload) => {
    try {
      const res = await addRating(payload);
      return res;
    } catch (err) {
       
      if (!err.isUnauthorized) {
        toast.error(err.response.data.error, toastErrorOpts);
      }
      throw err;
    }
  }
);

export const updateBookedSessionScheduledMeetingAsync = createAsyncThunk(
  "update/booked/session",
  async (payload, { dispatch }) => {
    const { status, updatePayload } = payload;
    const statusPayload = { status: status || "upcoming" };
    try {
      const response = await updateBookedSessionScheduledMeeting(updatePayload);
      dispatch(getScheduledMeetingDetailsAsync(statusPayload));
      return response;
    } catch (err) {
      if (!err.isUnauthorized) {
        toast.error(err.response.data.error, toastErrorOpts);
      }
      throw err;
    }
  }
);


export const addTraineeClipInBookedSessionAsync = createAsyncThunk(
  "add/clip/booked/session",
  async (payload, { dispatch }) => {
    try {
      const response = await addTraineeClipInBookedSession(payload);
      return response;
    } catch (err) {
      if (!err.isUnauthorized) {
        toast.error(err.response.data.error, toastErrorOpts);
      }
      throw err;
    }
  }
);

export const getScheduledMeetingDetailsAsync = createAsyncThunk(
  "get/scheduled/meetings",
  async (payload, { getState }) => {
    try {
      const state = getState();
      const bookings = state?.bookings;

      const requestedTab = payload?.status || null;
      const isByIdRequest = !!payload?.id;
      const cachedTab = bookings?.cachedTabBook || null;
      const lastFetchedTimestamps = bookings?.lastFetchedTimestamp || {};
      const forceRefresh = payload?.forceRefresh === true; // Allow force refresh flag

      // If force refresh is requested, skip cache
      if (!forceRefresh && !isByIdRequest) {
        const CACHE_TTL_MS = 60 * 1000; // 60 seconds

        if (requestedTab) {
          // Tab-specific request: cache hit if this tab's data was fetched recently.
          // Does NOT require it to be the same tab as `cachedTabBook` —
          // the user may have switched away and back within the TTL window.
          const lastFetched = lastFetchedTimestamps[requestedTab];
          const isFresh =
            typeof lastFetched === "number" &&
            Date.now() - lastFetched < CACHE_TTL_MS;
          const cachedDataForStatus =
            bookings?.scheduledMeetingDetailsByStatus?.[requestedTab];

          if (isFresh && Array.isArray(cachedDataForStatus) && cachedDataForStatus.length > 0) {
            return {
              data: cachedDataForStatus,
              cachedTabBook: requestedTab,
              fromCache: true,
            };
          }
        } else {
          // Full-list (no status) request: cache hit if full list was fetched recently.
          const lastFetched = lastFetchedTimestamps["all"];
          const isFresh =
            typeof lastFetched === "number" &&
            Date.now() - lastFetched < CACHE_TTL_MS;
          const fullList = bookings?.scheduledMeetingDetails;

          if (isFresh && Array.isArray(fullList) && fullList.length > 0) {
            return {
              data: fullList,
              cachedTabBook: null,
              fromCache: true,
            };
          }
        }
      }

      const response = await getScheduledMeetingDetails(payload);
      // Include the payload (tabBook) in the response for caching
      return {
        ...response,
        cachedTabBook: requestedTab,
        requestType: response?.requestType || (isByIdRequest ? "byId" : "list"),
        requestStatus: response?.requestStatus || requestedTab,
        fromCache: false,
      };
    } catch (err) {
      if (!err.isUnauthorized) {
        toast.error(err.response?.data?.error || "Something went wrong", toastErrorOpts);
      }
      throw err;
    }
  }
);

export const uploadProfilePictureAsync = createAsyncThunk(
  "add/profile_picture",
  async (payload) => {
    try {
      const response = await uploadProfilePicture(payload);
      return response;
    } catch (err) {
      if (!err.isUnauthorized) {
        toast.error(err.response.data.error, toastErrorOpts);
      }
      throw err;
    }
  }
);

export const bookingsSlice = createSlice({
  name: "bookings",
  initialState,
  reducers: {
    bookings: (state) => {
      return state;
    },
    addRating: (state, action) => {
      state.addRatingModel = action.payload;
    },
    removeProfilePicture: (state, action) => {
      state.profile_picture = action.payload;
    },
    handleLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    handleSelectedTrainer: (state, action) => {
      state.selectedTrainerId = action.payload;
    },
    removeProfileImageUrl: (state, action) => {
      state.profile_image_url = action.payload;
    },
    isMobileFriendly: (state, action) => {
      state.configs.sidebar = {
        ...state.configs.sidebar,
        isMobileMode: action.payload,
      };
    },
    isSidebarToggleEnabled: (state, action) => {
      state.configs.sidebar = {
        ...state.configs.sidebar,
        isToggleEnable: action.payload,
      };
    },
    handleActiveTab: (state, action) => {
      state.activeTab = action.payload;
    },
    handleSidebarTabClose: (state, action) => {
      state.sidebarTab = action.payload;
    },
    setStartMeeting: (state , action) =>{
      state.startMeeting = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getScheduledMeetingDetailsAsync.pending, (state) => {
        state.status = "pending";
        state.isMeetingLoading = true;
      })
      .addCase(getScheduledMeetingDetailsAsync.fulfilled, (state, action) => {
        state.status = "fulfilled";
        state.isMeetingLoading = false;
        const fetchedStatus = action.payload.cachedTabBook ?? "all";
        const requestType = action.payload.requestType || "list";
        const fetchedData = action.payload.data || [];

        if (requestType === "byId") {
          const merged = [...(state.scheduledMeetingDetails || [])];
          fetchedData.forEach((item) => {
            const idx = merged.findIndex((m) => m?._id === item?._id);
            if (idx === -1) merged.push(item);
            else merged[idx] = item;
          });
          state.scheduledMeetingDetails = merged;
          state.lastFetchedTimestamp = {
            ...state.lastFetchedTimestamp,
            byId: Date.now(),
          };
          return;
        }

        if (fetchedStatus && fetchedStatus !== "all") {
          state.scheduledMeetingDetailsByStatus[fetchedStatus] = fetchedData;
        }

        // When we fetched without status (full list), use it so instant lessons and all bookings show for both trainer and trainee
        if (fetchedStatus === "all" || fetchedStatus == null) {
          state.scheduledMeetingDetails = fetchedData;
          const now = new Date();
          state.scheduledMeetingDetailsByStatus.upcoming = fetchedData.filter(
            (item) =>
              (item?.status === "booked" || item?.status === "confirmed") &&
              (!item?.end_time || new Date(item.end_time) > now)
          );
          state.scheduledMeetingDetailsByStatus.completed = fetchedData.filter(
            (item) => item?.status === "completed"
          );
          state.scheduledMeetingDetailsByStatus.cancelled = fetchedData.filter(
            (item) => item?.status === "cancelled" || item?.status === "canceled"
          );
          state.scheduledMeetingDetailsByStatus.active = fetchedData.filter(
            (item) => item?.status === "booked" || item?.status === "confirmed"
          );
        } else {
          const allData = [
            ...(state.scheduledMeetingDetailsByStatus.upcoming || []),
            ...(state.scheduledMeetingDetailsByStatus.cancelled || []),
            ...(state.scheduledMeetingDetailsByStatus.completed || []),
            ...(state.scheduledMeetingDetailsByStatus.active || []),
          ];
          const uniqueData = allData.reduce((acc, current) => {
            const existingIndex = acc.findIndex((item) => item._id === current._id);
            if (existingIndex === -1) {
              acc.push(current);
            } else {
              acc[existingIndex] = current;
            }
            return acc;
          }, []);
          state.scheduledMeetingDetails = uniqueData;
        }

        state.lastFetchedTimestamp = {
          ...state.lastFetchedTimestamp,
          [fetchedStatus]: Date.now(),
        };
        state.cachedTabBook = action.payload.cachedTabBook;
      })
      .addCase(getScheduledMeetingDetailsAsync.rejected, (state, action) => {
        state.status = "rejected";
        state.isMeetingLoading = false;
      })
      .addCase(
        updateBookedSessionScheduledMeetingAsync.pending,
        (state, action) => {
          state.status = "pending";
        }
      )
      .addCase(
        updateBookedSessionScheduledMeetingAsync.fulfilled,
        (state, action) => {
          state.status = "fulfilled";
          toast.success(action.payload.message, toastSuccessOpts);
        }
      )
      .addCase(
        updateBookedSessionScheduledMeetingAsync.rejected,
        (state, action) => {
          state.status = "rejected";
        }
      )
      .addCase(
        addTraineeClipInBookedSessionAsync.pending,
        (state, action) => {
          state.status = "pending";
        }
      )
      .addCase(
        addTraineeClipInBookedSessionAsync.fulfilled,
        (state, action) => {
          state.status = "fulfilled";
          toast.success("Clips shared successfully", toastSuccessOpts);
        }
      )
      .addCase(
        addTraineeClipInBookedSessionAsync.rejected,
        (state, action) => {
          state.status = "rejected";
        }
      )
      .addCase(addRatingAsync.pending, (state, action) => {
        state.status = "pending";
      })
      .addCase(addRatingAsync.fulfilled, (state, action) => {
        state.status = "fulfilled";
        state.addRatingModel = { _id: null, isOpen: false };
        toast.success(action.payload.message, {
          type: "success",
          ...toastSuccessOpts,
        });
      })
      .addCase(addRatingAsync.rejected, (state, action) => {
        state.status = "rejected";
      })
      .addCase(uploadProfilePictureAsync.pending, (state, action) => {
        state.status = "pending";
      })
      .addCase(uploadProfilePictureAsync.fulfilled, (state, action) => {
        state.status = "fulfilled";
        state.profile_picture = action.payload.url;
        state.profile_image_url = action.payload.url;
      })
      .addCase(uploadProfilePictureAsync.rejected, (state, action) => {
        state.status = "rejected";
      });
  },
});

export default bookingsSlice.reducer;
export const bookingsState = (state) => state.bookings;
export const bookingsAction = bookingsSlice.actions;
