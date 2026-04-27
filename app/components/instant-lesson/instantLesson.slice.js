import { createSlice } from "@reduxjs/toolkit";

// UI State Machine States
export const UI_STATES = {
  INCOMING: "incoming",
  ACCEPTING: "accepting",
  DECLINING: "declining",
  EXPIRED: "expired",
  ERROR: "error",
};

// Step-based flow states for trainee
export const INSTANT_LESSON_STEPS = {
  REQUEST: 1,        // Step 1: Request Instant Lesson
  SELECT_VIDEOS: 2,  // Step 2: Select Videos (max 2)
  COACH_ACCEPTED: 3, // Step 3: Coach Accepted (Waiting State)
  JOIN_LESSON: 4,    // Step 4: Join Lesson
};

const initialState = {
  isIncoming: false,
  uiState: UI_STATES.INCOMING,
  lessonId: null,
  expiresAt: null,
  coachId: null,
  traineeInfo: null,
  lessonType: null,
  duration: null,
  requestData: null,
  errorMessage: null,
  isCountdownPaused: false,
  // Step-based flow state (for trainee)
  currentStep: null,
  selectedVideos: [],
  coachAccepted: false,
  canJoin: false,
  isTraineeFlow: false, // Flag to indicate trainee-side flow
};

export const instantLessonSlice = createSlice({
  name: "instantLesson",
  initialState,
  reducers: {
    setIncomingRequest: (state, action) => {
      state.isIncoming = true;
      state.uiState = UI_STATES.INCOMING;
      state.lessonId = action.payload.lessonId;
      state.expiresAt = action.payload.expiresAt;
      state.coachId = action.payload.coachId;
      state.traineeInfo = action.payload.traineeInfo;
      state.lessonType = action.payload.lessonType;
      state.duration = action.payload.duration;
      state.requestData = action.payload.requestData;
      state.errorMessage = null;
      state.isCountdownPaused = false;
    },
    clearIncomingRequest: (state) => {
      state.isIncoming = false;
      state.uiState = UI_STATES.INCOMING;
      state.lessonId = null;
      state.expiresAt = null;
      state.coachId = null;
      state.traineeInfo = null;
      state.lessonType = null;
      state.duration = null;
      state.requestData = null;
      state.errorMessage = null;
      state.isCountdownPaused = false;
    },
    setAccepting: (state) => {
      state.uiState = UI_STATES.ACCEPTING;
      state.isCountdownPaused = true;
    },
    setDeclining: (state) => {
      state.uiState = UI_STATES.DECLINING;
    },
    setExpired: (state) => {
      state.uiState = UI_STATES.EXPIRED;
      state.isCountdownPaused = true;
    },
    setError: (state, action) => {
      state.uiState = UI_STATES.ERROR;
      state.errorMessage = action.payload?.message || "An error occurred";
    },
    updateExpiresAt: (state, action) => {
      state.expiresAt = action.payload;
    },
    pauseCountdown: (state) => {
      state.isCountdownPaused = true;
    },
    resumeCountdown: (state) => {
      state.isCountdownPaused = false;
    },
    // Step-based flow actions
    setTraineeFlow: (state, action) => {
      state.isTraineeFlow = true;
      state.currentStep = INSTANT_LESSON_STEPS.REQUEST;
      state.lessonId = action.payload.lessonId;
      state.coachId = action.payload.coachId;
      state.traineeInfo = action.payload.traineeInfo;
      state.lessonType = action.payload.lessonType;
      state.duration = action.payload.duration;
      state.requestData = action.payload.requestData;
      state.selectedVideos = [];
      state.coachAccepted = false;
      state.canJoin = false;
    },
    setCurrentStep: (state, action) => {
      state.currentStep = action.payload;
      // Join is allowed once coach has accepted; clips are optional (0–2).
      state.canJoin =
        state.coachAccepted &&
        state.currentStep === INSTANT_LESSON_STEPS.JOIN_LESSON;
    },
    setSelectedVideos: (state, action) => {
      const videos = action.payload;
      // Enforce max 2 videos
      if (videos.length <= 2) {
        state.selectedVideos = videos;

        if (videos.length > 0 && state.currentStep === INSTANT_LESSON_STEPS.REQUEST) {
          state.currentStep = INSTANT_LESSON_STEPS.SELECT_VIDEOS;
        }
      }

      state.canJoin =
        state.coachAccepted &&
        state.currentStep === INSTANT_LESSON_STEPS.JOIN_LESSON;
    },
    setCoachAccepted: (state) => {
      state.coachAccepted = true;
      // Clips are optional: trainee can join as soon as coach accepts, with 0–2 videos.
      state.currentStep = INSTANT_LESSON_STEPS.JOIN_LESSON;
      state.canJoin = true;
    },
    clearTraineeFlow: (state) => {
      state.isTraineeFlow = false;
      state.currentStep = null;
      state.selectedVideos = [];
      state.coachAccepted = false;
      state.canJoin = false;
      state.lessonId = null;
      state.coachId = null;
      state.traineeInfo = null;
      state.lessonType = null;
      state.duration = null;
      state.requestData = null;
    },
    // Helper to initiate trainee flow from booking response
    initiateTraineeFlowFromBooking: (state, action) => {
      const { lessonId, coachId, traineeInfo, duration, requestData } = action.payload;
      state.isTraineeFlow = true;
      state.currentStep = INSTANT_LESSON_STEPS.REQUEST;
      state.lessonId = lessonId;
      state.coachId = coachId;
      state.traineeInfo = traineeInfo;
      state.lessonType = `${duration || 30} Minutes`;
      state.duration = duration || 30;
      state.requestData = requestData || {};
      state.selectedVideos = [];
      state.coachAccepted = false;
      state.canJoin = false;
    },
  },
});

export default instantLessonSlice.reducer;
export const instantLessonState = (state) => state.instantLesson;
export const instantLessonAction = instantLessonSlice.actions;
