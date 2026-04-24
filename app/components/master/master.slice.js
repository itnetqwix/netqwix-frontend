import { getMasterData } from "../master/master.api";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

export const initialState = {
  status: "idle",
  masterData: null,
};

export const getMasterDataAsync = createAsyncThunk(
  "master/get",
  async () => {
    try {
      const response = await getMasterData();
      return response;
    } catch (err) {
      throw err;
    }
  },
  {
    // Prevent duplicate in-flight requests: only fire when status is idle
    condition: (_, { getState }) => {
      const { status } = getState().master;
      return status === "idle";
    },
  }
);

export const masterSlice = createSlice({
  name: "master",
  initialState,
  reducers: {
    master: (state) => {
      return state;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getMasterDataAsync.pending, (state) => {
        state.status = "pending";
      })
      .addCase(getMasterDataAsync.fulfilled, (state, action) => {
        state.status = "fulfilled";
        if (
          action.payload &&
          action.payload.data &&
          action.payload.data.data &&
          action.payload.data.data.length
        ) {
          state.masterData = action.payload.data.data[0];
        } else {
          state.masterData = null;
        }
      })
      .addCase(getMasterDataAsync.rejected, (state) => {
        // Reset to idle so a retry is possible after a failure
        state.status = "idle";
      });
  },
});

export default masterSlice.reducer;
// Fixed: return state.master, not the entire root state
export const masterState = (state) => state.master;
export const masterAction = masterSlice.actions;
