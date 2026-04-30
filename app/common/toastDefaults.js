/**
 * Shared react-toastify durations so API-driven messages (from backend l10n)
 * dismiss in a predictable window instead of feeling sluggish or sticking forever.
 */
export const TOAST_MS = {
  success: 2300,
  info: 3000,
  warning: 4200,
  error: 4500,
};

export const toastSuccessOpts = { autoClose: TOAST_MS.success };
export const toastErrorOpts = { autoClose: TOAST_MS.error };
export const toastInfoOpts = { autoClose: TOAST_MS.info };
export const toastWarningOpts = { autoClose: TOAST_MS.warning };
