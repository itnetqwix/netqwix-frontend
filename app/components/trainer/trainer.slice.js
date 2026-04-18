import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getTrainers, updateDrawing, updateProfile } from "./trainer.api";
import { toast } from "react-toastify";
import { getMeAsync } from "../auth/auth.slice";

const TRAINERS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const initialState = {
  status: "idle",
  trainersList: [],
  selectedTrainerInfo: null,
  trainersLastFetchedAt: null,
};

export const updateDrawingAsync = createAsyncThunk(
  "update/drawing",
  async (payload) => {
    try {
      const response = await updateDrawing(payload);
      return response;
    } catch (err) {
      if (!err.isUnauthorized) {
        toast.error(err.response.data.error);
      }
      throw err;
    }
  }
);

//update Profile
export const updateProfileAsync = createAsyncThunk(
  "update/profile",
  async (payload, { dispatch }) => {
    try {
      const response = await updateProfile(payload);
      dispatch(getMeAsync());
      return response;
    } catch (err) {
      if (!err.isUnauthorized) {
        toast.error(err.response.data.error);
      }
      throw err;
    }
  }
);

export const getTrainersAsync = createAsyncThunk(
  "get/trainers",
  async (_, { getState }) => {
    const state = getState();
    const lastFetchedAt = state?.trainer?.trainersLastFetchedAt;
    const trainersList = state?.trainer?.trainersList;

    // Return cached data if it is still fresh — avoids re-fetching the full
    // trainer list every time the user navigates to the "Book Lesson" tab.
    if (
      lastFetchedAt &&
      Array.isArray(trainersList) &&
      trainersList.length > 0 &&
      Date.now() - lastFetchedAt < TRAINERS_CACHE_TTL_MS
    ) {
      return { data: trainersList, fromCache: true };
    }

    try {
      const response = await getTrainers();
      return response;
    } catch (err) {
      if (!err.isUnauthorized) {
        toast.error(err.response.data.error);
      }
      throw err;
    }
  }
);

export const trainerSlice = createSlice({
  name: "trainer",
  initialState,
  reducers: {
    trainer: (state) => {
      return state;
    },
    setSelectedTrainerInfo: (state, action) => {
      state.selectedTrainerInfo = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(updateDrawingAsync.pending, (state, action) => {
        state.status = "pending";
      })
      .addCase(updateDrawingAsync.fulfilled, (state, action) => {
        state.status = "fulfilled";
      })
      .addCase(updateDrawingAsync.rejected, (state, action) => {
        state.status = "rejected";
      })
      .addCase(updateProfileAsync.pending, (state, action) => {
        state.status = "pending";
      })
      .addCase(updateProfileAsync.fulfilled, (state, action) => {
        toast.success(action.payload.data.message);
        state.status = "fulfilled";
      })
      .addCase(updateProfileAsync.rejected, (state, action) => {
        state.status = "rejected";
      })
      .addCase(getTrainersAsync.pending, (state, action) => {
        state.status = "pending";
      })
      .addCase(getTrainersAsync.fulfilled, (state, action) => {
        state.trainersList = action.payload.data;
        state.status = "fulfilled";
        // Only update timestamp when we actually hit the network (not from cache)
        if (!action.payload.fromCache) {
          state.trainersLastFetchedAt = Date.now();
        }
      })
      .addCase(getTrainersAsync.rejected, (state, action) => {
        state.status = "rejected";
      });
  },
});
export default trainerSlice.reducer;
export const trainerState = (state) => state.trainer;
export const trainerAction = trainerSlice.actions;
