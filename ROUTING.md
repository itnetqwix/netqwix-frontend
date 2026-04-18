# Netqwix Frontend – Routing Overview

This document maps every URL route to the page file and main feature component it renders.
It also notes which layout/guard wraps the page and what data it relies on.

---

## Route Table

| URL | Page file | Main component | Layout | Auth? |
|-----|-----------|----------------|--------|-------|
| `/` | `pages/index.jsx` | `pages/landing/index.jsx` (landing page) | None | No |
| `/auth/signIn` | `pages/auth/signIn/index.jsx` | `app/components/auth/SignIn` | None | No |
| `/auth/signInClassic` | `pages/auth/signInClassic/index.jsx` | `app/components/auth/SignInClassic` | None | No |
| `/auth/signUp` | `pages/auth/signUp/index.jsx` | `app/components/auth/SignUp` | None | No |
| `/auth/signUpClassic` | `pages/auth/signUpClassic/index.jsx` | `app/components/auth/SignUpClassic` | None | No |
| `/auth/forgetPassword` | `pages/auth/forgetPassword/index.jsx` | `app/components/auth/ForgetPassword` | None | No |
| `/auth/verified-forget-password` | `pages/auth/verified-forget-password/index.jsx` | — | None | No |
| `/dashboard` | `pages/dashboard/index.jsx` → `app/features/dashboard/DashboardPage.jsx` | `app/components/NavHomePage` | `DashboardLayout` | Yes (via DashboardLayout) |
| `/dashboard/home` | `pages/dashboard/home.jsx` | `app/components/NavHomePage` | `DashboardLayout` | Yes |
| `/dashboard/book-lesson` | `pages/dashboard/book-lesson.jsx` | `TraineeDashboardContainer` / `TrainerDashboardContainer` | `DashboardLayout` | Yes |
| `/dashboard/schedule` | `pages/dashboard/schedule.jsx` | `Bookings` / `ScheduleInventory` / `SchedulePage` | `DashboardLayout` | Yes |
| `/dashboard/upcoming-sessions` | `pages/dashboard/upcoming-sessions.jsx` | `UpcomingSession` (`app/features/bookings`) | `DashboardLayout` | Yes |
| `/dashboard/meeting-room` | `pages/dashboard/meeting-room.jsx` | `app/features/bookings` meetingRoom | `DashboardLayout` | Yes |
| `/dashboard/chats` | `pages/dashboard/chats.jsx` | `ChitChat` / `RightSide` | `DashboardLayout` | Yes |
| `/dashboard/friends` | `pages/dashboard/friends.jsx` | `StudentRecord` | `DashboardLayout` | Yes |
| `/dashboard/student` | `pages/dashboard/student.jsx` | `StudentRecord` | `DashboardLayout` | Yes |
| `/dashboard/my-community` | `pages/dashboard/my-community.jsx` | `MyCommunity` | `DashboardLayout` | Yes |
| `/dashboard/practice-session` | `pages/dashboard/practice-session.jsx` | `PracticeLiveExperience` | `DashboardLayout` | Yes |
| `/dashboard/about-us` | `pages/dashboard/about-us.jsx` | `AboutUs` | `DashboardLayout` | Yes |
| `/dashboard/contact-us` | `pages/dashboard/contact-us.jsx` | `ContactUs` | `DashboardLayout` | Yes |
| `/meeting?id=<bookingId>` | `pages/meeting/index.jsx` | `VideoCallUI` (`app/features/meeting`) | None (full-screen) | Yes (reads `accountType` from Redux/localStorage) |
| `/messenger` | `pages/messenger/index.jsx` | — | — | — |

---

## Layout Components

### `DashboardLayout` (`app/components/dashboard/DashboardLayout.jsx`)

Wraps all `/dashboard/**` routes. Provides:
- Left sidebar (`containers/leftSidebar`)
- Header (`app/components/Header`)
- Centralized initial data fetch via `useDashboardData` hook:
  - `getMasterDataAsync()` — sports/categories metadata
  - `getAllNotifications()` — notification bell
  - `getMeAsync()` — current user profile

**Auth guard**: DashboardLayout checks `userInfo` and redirects unauthenticated users. There is no separate `AuthGuard` wrapper component currently — auth logic lives inside `DashboardLayout` itself.

> Pattern for new pages:
> ```jsx
> // pages/dashboard/my-new-page.jsx
> import DashboardLayout from '../../app/components/dashboard/DashboardLayout';
> import MyFeature from '../../app/features/my-feature';
>
> export default function MyNewPage() {
>   return (
>     <DashboardLayout>
>       <MyFeature />
>     </DashboardLayout>
>   );
> }
> ```

---

## Feature Entry Points (`app/features/`)

These are thin wrappers that give routes a stable import path without exposing internals:

| Feature path | What it exports |
|---|---|
| `app/features/dashboard/DashboardPage.jsx` | `NavHomePage` wrapped in `DashboardLayout` |
| `app/features/meeting/index.jsx` | Re-exports `VideoCallUI` from `portrait-calling` |
| `app/features/bookings/index.jsx` | Exports `Bookings`, `UpcomingSession`, `meetingRoom` |

---

## Meeting / Video Call Route (`/meeting?id=`)

`pages/meeting/index.jsx` is **not** wrapped in `DashboardLayout` — it runs full-screen.

Data flow:
1. On mount, dispatches `getScheduledMeetingDetailsAsync()` to populate Redux.
2. Finds the booking by `router.query.id` from `scheduledMeetingDetails`.
3. Renders `VideoCallUI` (via `app/features/meeting`) passing `traineeInfo`, `trainerInfo`, `session_end_time`, etc.
4. On close, navigates back to `/dashboard`.

Key components in the call:
- `app/features/meeting/index.jsx` → `app/components/portrait-calling/index.jsx` (`VideoCallUI`)
- `app/components/portrait-calling/clip-mode.jsx` (`ClipModeCall`, `VideoContainer`)
- `app/components/portrait-calling/one-on-one-call.jsx`
- `app/components/video/callEngine.js` (PeerJS WebRTC)
- `app/components/video/hooks/useLessonTimer.js` (countdown timer)
- `app/components/video/hooks/useClipModePlayer.js` (clip play/pause sync)
- `app/components/video/socketClient.js` (all socket emit helpers)

---

## Routing Paths Constant

All URL strings are centralized in `app/common/constants.js` under `routingPaths`:

```js
export const routingPaths = {
  landing: "/",
  dashboard: "/dashboard",
  dashboardUpcomingSessions: "/dashboard/upcoming-sessions",
  dashboardSchedule: "/dashboard/schedule",
  signUp: "/auth/signUp",
  signIn: "/auth/signIn",
  meeting: "/meeting",
  messenger: "/messenger",
  // ... auth, blog, bonus routes
};
```

Always use `routingPaths.xxx` instead of hard-coding URL strings.

---

## Guidelines for New Routes

1. **Dashboard pages** — use `DashboardLayout`; keep the page file under 40 lines; delegate to `app/features/<feature>/index.jsx`.
2. **Full-screen experiences** (video call, auth) — no layout wrapper.
3. **Data fetching** — don't fetch in page files; let `DashboardLayout`'s `useDashboardData` or the feature component's own hook handle it.
4. **Tab state** — dispatch `authAction.setTopNavbarActiveTab(...)` or `authAction.setActiveTab(...)` from `useEffect` in the page file.
