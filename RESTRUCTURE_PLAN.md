# NetQwix Frontend — Full Restructure Plan
> Next.js 14 App Router · Redux Toolkit with RTK Query · Optimized Architecture

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Problems to Fix](#2-problems-to-fix)
3. [Proposed Folder Structure](#3-proposed-folder-structure)
4. [Routing Strategy](#4-routing-strategy)
5. [Redux + RTK Query Architecture](#5-redux--rtk-query-architecture)
6. [Caching Strategy](#6-caching-strategy)
7. [Performance Optimization](#7-performance-optimization)
8. [Files to Delete](#8-files-to-delete)
9. [Migration Phase Plan](#9-migration-phase-plan)
10. [Timeline](#10-timeline)
11. [Post-Migration Checklist](#11-post-migration-checklist)

---

## 1. Current State Analysis

| Area | Current | Target |
|------|---------|--------|
| Next.js version | 13.1.1 (Pages Router) | 14.x (App Router) |
| Routing | `/pages/**` flat structure | `/app/**` nested layouts |
| Redux | 12 manual slices, duplicate slices | RTK Query + 8 clean slices |
| API layer | 14 separate axios files | 1 RTK Query `baseApi` + tag-based caching |
| Auth guard | Component wrapper (client-side only) | Middleware + server-side guards |
| Caching | None (every render re-fetches) | RTK Query automatic + Next.js cache |
| Bundle size | Moment.js + 3 video libraries loaded always | Dynamic import + tree-shaking |
| TypeScript | Config exists but unused | Full TypeScript across all files |
| Styling | 80+ scattered SCSS files | Co-located CSS Modules or Tailwind |
| Error handling | Inconsistent per-file | Centralized `error.ts` + Sentry |

---

## 2. Problems to Fix

### Critical
- **Duplicate Redux slices** — `/app/common/common.slice.js` AND `/app/components/common/common.slice.js` both named `common`/`bookings` — one silently overwrites the other in the store
- **Duplicate API modules** — `/app/common/common.api.js` vs `/app/components/common/common.api.js` define different endpoints
- **No server-side route protection** — `AuthGuard` runs only on client; bots and SSR see protected pages
- **Socket opens before auth check** — `SocketProvider` is above `AuthGuard`; unauthenticated users open sockets
- **localStorage without SSR guard** — causes hydration mismatches (`window is not defined`)

### Moderate
- 22 duplicate "landing" variant pages with near-identical markup
- Legacy routing constants duplicated in 3 places (`constants.js`, `routes.config.js`, `utils/navigation.js`)
- No standardized error shape from API — every slice handles errors differently
- Three video/media libraries shipped together (ReactPlayer + Vidstack + react-video-js-player)
- No loading/skeleton states — spinners block entire page renders

### Minor
- Magic strings for API endpoints (no single endpoint constants file)
- Mix of `.js` / `.jsx` extensions without convention
- `console.log` / `console.error` debug statements left in production code
- No TypeScript types on API responses — bugs silently pass through

---

## 3. Proposed Folder Structure

```
nq-frontend/                          ← root
│
├── app/                              ← Next.js 14 App Router root
│   ├── layout.tsx                    ← Root layout (Providers, fonts, analytics)
│   ├── loading.tsx                   ← Global loading skeleton
│   ├── error.tsx                     ← Global error boundary
│   ├── not-found.tsx                 ← 404 page
│   │
│   ├── (public)/                     ← Route group — no auth required
│   │   ├── layout.tsx                ← Public layout (no sidebar)
│   │   ├── page.tsx                  ← / → Landing home
│   │   ├── auth/
│   │   │   ├── sign-in/
│   │   │   │   └── page.tsx
│   │   │   ├── sign-up/
│   │   │   │   └── page.tsx
│   │   │   ├── forgot-password/
│   │   │   │   └── page.tsx
│   │   │   └── reset-password/
│   │   │       └── page.tsx
│   │   └── landing/
│   │       ├── page.tsx              ← Main landing
│   │       ├── how-it-works/page.tsx
│   │       ├── why-choose-us/page.tsx
│   │       ├── faq/page.tsx
│   │       └── top-trainers/page.tsx
│   │
│   ├── (protected)/                  ← Route group — requires auth
│   │   ├── layout.tsx                ← Protected layout (Header + Sidebar + Socket)
│   │   │
│   │   ├── dashboard/
│   │   │   ├── page.tsx              ← /dashboard → Home
│   │   │   ├── loading.tsx
│   │   │   ├── schedule/
│   │   │   │   └── page.tsx
│   │   │   ├── book-lesson/          ← TRAINEE only
│   │   │   │   └── page.tsx
│   │   │   ├── upcoming-sessions/
│   │   │   │   └── page.tsx
│   │   │   ├── my-community/
│   │   │   │   └── page.tsx
│   │   │   ├── meeting-room/
│   │   │   │   └── page.tsx
│   │   │   ├── practice-session/     ← TRAINER only
│   │   │   │   └── page.tsx
│   │   │   ├── chats/
│   │   │   │   └── page.tsx
│   │   │   ├── friends/
│   │   │   │   └── page.tsx
│   │   │   └── settings/
│   │   │       └── page.tsx
│   │   │
│   │   ├── meeting/
│   │   │   └── page.tsx              ← Full-screen video conference
│   │   │
│   │   └── messenger/
│   │       └── page.tsx
│   │
│   ├── (info)/                       ← Route group — static/info pages
│   │   ├── layout.tsx
│   │   ├── blog/
│   │   │   ├── page.tsx              ← Blog listing
│   │   │   └── [slug]/page.tsx       ← Blog post (SSG)
│   │   ├── contact/page.tsx
│   │   └── about/page.tsx
│   │
│   └── api/                          ← API Routes (server only)
│       ├── auth/
│       │   └── [...nextauth]/route.ts
│       └── peer/
│           └── route.ts
│
├── components/                        ← Shared UI components (no business logic)
│   ├── ui/                            ← Primitives (Button, Input, Modal, Badge…)
│   │   ├── button/
│   │   │   ├── Button.tsx
│   │   │   └── Button.module.scss
│   │   ├── modal/
│   │   │   ├── Modal.tsx
│   │   │   └── Modal.module.scss
│   │   ├── loader/
│   │   │   ├── Spinner.tsx
│   │   │   └── Skeleton.tsx
│   │   ├── rating/
│   │   │   └── Rating.tsx
│   │   ├── accordion/
│   │   │   └── Accordion.tsx
│   │   ├── carousel/
│   │   │   └── Carousel.tsx
│   │   └── index.ts                   ← Barrel export
│   │
│   └── layout/                        ← Layout components
│       ├── Header/
│       │   ├── Header.tsx
│       │   ├── Header.module.scss
│       │   └── nav-items.ts
│       ├── Sidebar/
│       │   ├── Sidebar.tsx
│       │   └── Sidebar.module.scss
│       └── Footer/
│           └── Footer.tsx
│
├── features/                          ← Feature modules (co-locate slice+api+components)
│   ├── auth/
│   │   ├── components/
│   │   │   ├── SignInForm.tsx
│   │   │   ├── SignUpForm.tsx
│   │   │   ├── GoogleOAuthButton.tsx
│   │   │   └── ForgotPasswordForm.tsx
│   │   ├── auth.api.ts               ← RTK Query endpoints
│   │   ├── auth.slice.ts             ← Auth state (token, userInfo, role)
│   │   └── auth.types.ts             ← TypeScript interfaces
│   │
│   ├── video/
│   │   ├── components/
│   │   │   ├── VideoCallLayout.tsx
│   │   │   ├── VideoCallHeader.tsx
│   │   │   ├── VideoCallControls.tsx
│   │   │   ├── UserVideo.tsx
│   │   │   ├── ClipsContainer.tsx
│   │   │   ├── CanvasDrawing.tsx
│   │   │   ├── ScreenshotPanel.tsx
│   │   │   └── PermissionModal.tsx
│   │   ├── hooks/
│   │   │   ├── useVideoCall.ts
│   │   │   ├── useVideoRecording.ts
│   │   │   ├── useCanvasDrawing.ts
│   │   │   ├── useLessonTimer.ts
│   │   │   ├── useSocketEvents.ts
│   │   │   ├── useClipPlayback.ts
│   │   │   └── useScreenshots.ts
│   │   ├── utils/
│   │   │   ├── callEngine.ts
│   │   │   ├── socketClient.ts
│   │   │   ├── videoUtils.ts
│   │   │   ├── callQualityMonitor.ts
│   │   │   └── webrtcCompatibility.ts
│   │   ├── video.api.ts
│   │   ├── video.slice.ts
│   │   └── video.types.ts
│   │
│   ├── bookings/
│   │   ├── components/
│   │   │   ├── BookingCard.tsx
│   │   │   ├── BookingList.tsx
│   │   │   ├── UpcomingSession.tsx
│   │   │   ├── StartSessionModal.tsx
│   │   │   ├── SelectClipsModal.tsx
│   │   │   ├── ShareModal.tsx
│   │   │   └── RatingModal.tsx
│   │   ├── hooks/
│   │   │   └── useBookings.ts
│   │   ├── bookings.api.ts
│   │   ├── bookings.slice.ts
│   │   └── bookings.types.ts
│   │
│   ├── schedule/
│   │   ├── components/
│   │   │   ├── CalendarView.tsx
│   │   │   ├── AvailabilityForm.tsx
│   │   │   └── SlotPicker.tsx
│   │   ├── schedule.api.ts
│   │   ├── schedule.slice.ts
│   │   └── schedule.types.ts
│   │
│   ├── clips/
│   │   ├── components/
│   │   │   ├── ClipCard.tsx
│   │   │   ├── UploadClipForm.tsx
│   │   │   └── ClipGrid.tsx
│   │   ├── clips.api.ts
│   │   ├── clips.slice.ts
│   │   └── clips.types.ts
│   │
│   ├── trainer/
│   │   ├── components/
│   │   │   ├── TrainerCard.tsx
│   │   │   ├── TrainerProfile.tsx
│   │   │   └── TrainerStudentList.tsx
│   │   ├── trainer.api.ts
│   │   ├── trainer.slice.ts
│   │   └── trainer.types.ts
│   │
│   ├── trainee/
│   │   ├── components/
│   │   │   └── TraineeProfile.tsx
│   │   ├── trainee.api.ts
│   │   ├── trainee.slice.ts
│   │   └── trainee.types.ts
│   │
│   ├── notifications/
│   │   ├── components/
│   │   │   └── NotificationBell.tsx
│   │   ├── notifications.api.ts
│   │   └── notifications.slice.ts
│   │
│   ├── instant-lesson/
│   │   ├── components/
│   │   │   └── InstantLessonBanner.tsx
│   │   ├── instantLesson.api.ts
│   │   └── instantLesson.slice.ts
│   │
│   ├── transactions/
│   │   ├── components/
│   │   │   └── TransactionHistory.tsx
│   │   ├── transactions.api.ts
│   │   └── transactions.slice.ts
│   │
│   └── dashboard/
│       ├── components/
│       │   ├── FriendRequestsSection.tsx
│       │   ├── ActiveSessionsSection.tsx
│       │   └── DashboardBanner.tsx
│       ├── dashboard.api.ts
│       └── dashboard.types.ts
│
├── lib/                               ← Infrastructure / pure utilities
│   ├── redux/
│   │   ├── store.ts                   ← Configured Redux store
│   │   ├── baseApi.ts                 ← Single RTK Query base API
│   │   ├── StoreProvider.tsx          ← Client-side Redux Provider
│   │   └── hooks.ts                   ← useAppDispatch, useAppSelector
│   ├── axios/
│   │   └── axiosInstance.ts           ← Axios instance (for non-RTQ calls)
│   ├── socket/
│   │   ├── SocketProvider.tsx         ← Context-based Socket.io provider
│   │   ├── socketEvents.ts            ← All event constants (typed)
│   │   └── socketClient.ts            ← Emit helper functions
│   ├── auth/
│   │   └── authGuard.ts               ← Server + client guard utilities
│   └── stripe/
│       └── StripeProvider.tsx
│
├── hooks/                             ← App-wide custom hooks
│   ├── useMediaQuery.ts
│   ├── useWindowDimensions.ts
│   ├── useDebounce.ts
│   └── useLocalStorage.ts             ← SSR-safe localStorage hook
│
├── types/                             ← Global TypeScript types
│   ├── api.types.ts                   ← Shared API response shapes
│   ├── user.types.ts                  ← User, Trainer, Trainee types
│   └── common.types.ts
│
├── utils/                             ← Pure functions, no React
│   ├── date.ts                        ← Date formatting (replace Moment with date-fns)
│   ├── validation.ts                  ← Yup schemas
│   ├── storage.ts                     ← SSR-safe storage helpers
│   ├── url.ts                         ← URL/S3 helpers
│   └── constants.ts                   ← App-wide constants (single source of truth)
│
├── styles/                            ← Global styles only
│   ├── globals.scss                   ← Reset + global vars
│   ├── variables.scss                 ← SCSS variables (colors, spacing)
│   └── mixins.scss                    ← Reusable SCSS mixins
│
├── public/                            ← Static assets
│   ├── images/
│   ├── fonts/
│   ├── sounds/
│   └── icons/
│
├── middleware.ts                      ← Next.js middleware (auth route protection)
├── next.config.ts                     ← Next.js configuration
├── tsconfig.json
├── .env.local
└── package.json
```

---

## 4. Routing Strategy

### 4.1 Route Groups (Next.js 14 App Router)

Route groups use `(parentheses)` to share layouts without adding URL segments:

```
(public)    → no auth needed, uses PublicLayout
(protected) → auth required, uses ProtectedLayout with Header + Sidebar
(info)      → static/marketing pages, simple layout
```

### 4.2 Middleware-Based Auth Guard

Replace client-side `AuthGuard.jsx` with server-side `middleware.ts`:

```typescript
// middleware.ts — runs on the Edge before any page renders
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/', '/auth/sign-in', '/auth/sign-up', '/landing/:path*']
const TRAINEE_ONLY = ['/dashboard/book-lesson']
const TRAINER_ONLY = ['/dashboard/practice-session', '/dashboard/student']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('token')?.value
  const role = request.cookies.get('acc_type')?.value

  // Unauthenticated → redirect to sign-in
  if (!token && isProtectedPath(pathname)) {
    return NextResponse.redirect(new URL('/auth/sign-in', request.url))
  }

  // Authenticated → redirect away from auth pages
  if (token && isAuthPath(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Role-based access
  if (role === 'Trainee' && TRAINER_ONLY.includes(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (role === 'Trainer' && TRAINEE_ONLY.includes(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/peer).*)'],
}
```

**Why middleware over AuthGuard:**
- Runs on the Edge (before page render) — no flash of protected content
- Works for both SSR and CSR
- Handles role-based routing in one place
- Bots cannot see protected page markup

### 4.3 Route Map (Complete)

| URL | Role | Description |
|-----|------|-------------|
| `/` | All | Landing home |
| `/landing/how-it-works` | All | Marketing |
| `/landing/why-choose-us` | All | Marketing |
| `/landing/faq` | All | Marketing |
| `/landing/top-trainers` | All | Marketing |
| `/auth/sign-in` | Guest | Login |
| `/auth/sign-up` | Guest | Registration |
| `/auth/forgot-password` | Guest | Password reset |
| `/auth/reset-password` | Guest | Set new password |
| `/dashboard` | Auth | Home |
| `/dashboard/schedule` | Auth | Calendar |
| `/dashboard/book-lesson` | Trainee | Book a lesson |
| `/dashboard/upcoming-sessions` | Auth | Upcoming sessions |
| `/dashboard/my-community` | Auth | Friends/community |
| `/dashboard/meeting-room` | Auth | Meeting room |
| `/dashboard/practice-session` | Trainer | Practice |
| `/dashboard/chats` | Auth | Messaging |
| `/dashboard/friends` | Auth | Friend list |
| `/meeting` | Auth | Video conference (full screen) |
| `/messenger` | Auth | Messenger |
| `/blog` | All | Blog listing |
| `/blog/[slug]` | All | Blog post |
| `/contact` | All | Contact us |
| `/about` | All | About us |

---

## 5. Redux + RTK Query Architecture

### 5.1 Single Base API (RTK Query)

Replace 14 separate axios API files with one RTK Query `baseApi`:

```typescript
// lib/redux/baseApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { RootState } from './store'

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.token
      if (token) headers.set('Authorization', `Bearer ${token}`)
      return headers
    },
  }),
  tagTypes: [
    'Auth',
    'Bookings',
    'Schedule',
    'Clips',
    'Trainer',
    'Trainee',
    'Notifications',
    'Transactions',
    'Dashboard',
  ],
  endpoints: () => ({}),
})
```

Each feature injects its endpoints:

```typescript
// features/bookings/bookings.api.ts
import { baseApi } from '@/lib/redux/baseApi'
import type { Booking, CreateBookingPayload } from './bookings.types'

export const bookingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getBookings: builder.query<Booking[], { status?: string }>({
      query: ({ status } = {}) => ({
        url: '/bookings',
        params: status ? { status } : undefined,
      }),
      providesTags: (result) =>
        result
          ? [...result.map(({ _id }) => ({ type: 'Bookings' as const, id: _id })), 'Bookings']
          : ['Bookings'],
    }),
    getBookingById: builder.query<Booking, string>({
      query: (id) => `/bookings/${id}`,
      providesTags: (_, __, id) => [{ type: 'Bookings', id }],
    }),
    createBooking: builder.mutation<Booking, CreateBookingPayload>({
      query: (body) => ({ url: '/bookings', method: 'POST', body }),
      invalidatesTags: ['Bookings', 'Schedule'],  // auto-refetch list + calendar
    }),
    addRating: builder.mutation<void, { bookingId: string; rating: number; review: string }>({
      query: ({ bookingId, ...body }) => ({
        url: `/bookings/${bookingId}/rating`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_, __, { bookingId }) => [{ type: 'Bookings', id: bookingId }],
    }),
  }),
  overrideExisting: false,
})

export const {
  useGetBookingsQuery,
  useGetBookingByIdQuery,
  useCreateBookingMutation,
  useAddRatingMutation,
} = bookingsApi
```

### 5.2 Clean Redux Slices (8 total, no duplicates)

**Before (current — 12 slices with 2 duplicates):**
```
auth, master, scheduleInventory, trainee, trainer,
bookings (duplicate!), common (duplicate!),
videoupload, transaction, contactus, notification, instantLesson
```

**After (8 clean slices):**

| Slice | State Managed | Why Redux (not RTK Query) |
|-------|--------------|--------------------------|
| `auth` | token, userInfo, role, isLoggedIn | Cross-cutting, needed by middleware |
| `ui` | modals open/closed, active tab, sidebar state | Pure UI state, not server data |
| `video` | WebRTC call state, canvas strokes, local stream | Real-time, not cacheable |
| `socket` | connection status, pending events queue | Real-time |
| `instantLesson` | pending lesson request, accept/decline state | Real-time push state |
| `notifications` | unread count, notification list (optimistic) | Real-time updates |

All server data (bookings, schedule, clips, etc.) → **RTK Query** (auto-caching, deduplication).

### 5.3 Store Configuration

```typescript
// lib/redux/store.ts
import { configureStore } from '@reduxjs/toolkit'
import { baseApi } from './baseApi'
import authReducer from '@/features/auth/auth.slice'
import uiReducer from '@/features/ui/ui.slice'
import videoReducer from '@/features/video/video.slice'
import socketReducer from '@/lib/socket/socket.slice'
import instantLessonReducer from '@/features/instant-lesson/instantLesson.slice'
import notificationsReducer from '@/features/notifications/notifications.slice'

export const makeStore = () =>
  configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,  // RTK Query
      auth: authReducer,
      ui: uiReducer,
      video: videoReducer,
      socket: socketReducer,
      instantLesson: instantLessonReducer,
      notifications: notificationsReducer,
    },
    middleware: (getDefault) =>
      getDefault().concat(baseApi.middleware),
  })

export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
```

### 5.4 StoreProvider for App Router

```typescript
// lib/redux/StoreProvider.tsx
'use client'
import { useRef } from 'react'
import { Provider } from 'react-redux'
import { makeStore, AppStore } from './store'

export default function StoreProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<AppStore | null>(null)
  if (!storeRef.current) storeRef.current = makeStore()

  return <Provider store={storeRef.current}>{children}</Provider>
}
```

---

## 6. Caching Strategy

### 6.1 RTK Query Cache Tags

Tag-based invalidation means data auto-refreshes after mutations:

```
getBookings          → providesTags: ['Bookings']
createBooking        → invalidatesTags: ['Bookings', 'Schedule']
cancelBooking        → invalidatesTags: ['Bookings']
getAvailableSlots    → providesTags: ['Schedule']
addTrainerSchedule   → invalidatesTags: ['Schedule']
getClips             → providesTags: ['Clips']
uploadClip           → invalidatesTags: ['Clips']
getNotifications     → providesTags: ['Notifications']
markAsRead           → invalidatesTags: ['Notifications']
```

### 6.2 RTK Query Cache Lifetime (keepUnusedDataFor)

```typescript
// Tuned per data type
getBookings          keepUnusedDataFor: 300   // 5 min — changes after actions
getClips             keepUnusedDataFor: 600   // 10 min — rarely changes
getTrainers          keepUnusedDataFor: 900   // 15 min — relatively stable
getNotifications     keepUnusedDataFor: 60    // 1 min — frequently updated
getMeetingDetails    keepUnusedDataFor: 60    // 1 min — active meeting state
```

### 6.3 Next.js Server-Side Caching

For public pages fetched server-side (no user data):

```typescript
// app/(public)/landing/top-trainers/page.tsx
export const revalidate = 3600 // ISR: regenerate every 1 hour

async function getTopTrainers() {
  const res = await fetch(`${process.env.API_BASE_URL}/trainers/top`, {
    next: { revalidate: 3600 },  // Next.js data cache
  })
  return res.json()
}
```

### 6.4 Prefetching Critical Routes

```typescript
// Prefetch dashboard data server-side so client hydrates instantly
// app/(protected)/dashboard/page.tsx
import { makeStore } from '@/lib/redux/store'
import { bookingsApi } from '@/features/bookings/bookings.api'

export default async function DashboardPage() {
  const store = makeStore()
  await store.dispatch(bookingsApi.endpoints.getBookings.initiate({ status: 'upcoming' }))
  // Pass preloaded state to client → zero loading flash
}
```

---

## 7. Performance Optimization

### 7.1 Remove Moment.js → date-fns

Moment.js is 67KB gzipped. Replace with `date-fns` (tree-shakeable):

```typescript
// Before (42KB just for formatting)
import moment from 'moment'
moment(date).format('MMM Do YYYY')

// After (imports only what you use ~2KB)
import { format } from 'date-fns'
format(new Date(date), 'MMM do yyyy')
```

### 7.2 Dynamic Import Heavy Components

```typescript
// Video conference page — only loads when entering meeting
const VideoCallLayout = dynamic(
  () => import('@/features/video/components/VideoCallLayout'),
  { ssr: false, loading: () => <MeetingRoomSkeleton /> }
)

// FullCalendar — heavy library, only for schedule page
const CalendarView = dynamic(
  () => import('@/features/schedule/components/CalendarView'),
  { ssr: false }
)

// Fabric.js / Canvas — only inside active video call
const CanvasDrawing = dynamic(
  () => import('@/features/video/components/CanvasDrawing'),
  { ssr: false }
)
```

### 7.3 Consolidate Video Libraries

Remove 2 of 3 overlapping video libraries:

| Library | Status | Reason |
|---------|--------|--------|
| `react-player` | **Keep** | Handles clip playback (YouTube, S3, etc.) |
| `vidstack` | Remove | Redundant with react-player |
| `react-video-js-player` | Remove | Redundant |

### 7.4 Image Optimization

```typescript
// Use Next.js Image for all images
import Image from 'next/image'

<Image
  src={trainer.profilePicture}
  alt={trainer.name}
  width={80}
  height={80}
  placeholder="blur"
  blurDataURL="data:image/..."
/>
```

```typescript
// next.config.ts
const config = {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },  // S3
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },  // Google profile pics
    ],
  },
}
```

### 7.5 SCSS Consolidation

Reduce 80+ SCSS files to co-located CSS Modules:

```
Before: /public/assets/scss/pages/dashboard.scss (global, hard to tree-shake)
After:  /app/(protected)/dashboard/page.module.scss (co-located, only loaded for this page)
```

Keep a slim `styles/globals.scss` for:
- CSS custom properties (variables)
- Reset/normalize
- Typography

### 7.6 Bundle Analysis

```bash
# Add to package.json scripts
"analyze": "ANALYZE=true next build"
```

```typescript
// next.config.ts
import bundleAnalyzer from '@next/bundle-analyzer'
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' })
export default withBundleAnalyzer(config)
```

### 7.7 Suspense Boundaries for Streaming

```typescript
// app/(protected)/dashboard/page.tsx
import { Suspense } from 'react'

export default function DashboardPage() {
  return (
    <div>
      <Suspense fallback={<FriendRequestsSkeleton />}>
        <FriendRequestsSection />
      </Suspense>
      <Suspense fallback={<ActiveSessionsSkeleton />}>
        <ActiveSessionsSection />
      </Suspense>
    </div>
  )
}
```

---

## 8. Files to Delete

### Delete Entirely (Duplicates / Dead Code)

```
# Duplicate common modules — merged into features/
/app/common/common.slice.js           → merged into features/clips/clips.slice.ts
/app/common/common.api.js             → merged into features/clips/clips.api.ts
/app/components/common/common.slice.js → merged into features/bookings/bookings.slice.ts
/app/components/common/common.api.js  → merged into features/bookings/bookings.api.ts

# Legacy routing — replaced by middleware.ts
/app/utils/routeGuards.js
/app/utils/navigation.js
/app/config/routes.config.js          → moved to utils/constants.ts (minimal)
/app/common/constants.js              → merged into utils/constants.ts

# Replaced by RTK Query
/config/axios-interceptor.js          → baseApi.ts handles auth headers

# Unused/redundant pages
/pages/auth/signUpClassic/index.jsx   → same as signUp (legacy)
/pages/auth/signInClassic/index.jsx   → same as signIn (legacy)
/pages/auth/verified-forget-password/ → renamed to reset-password

# Landing page duplicates (22 → 5 meaningful pages)
/pages/landing/                       → keep only: index, how-it-works, why-choose-us, faq, top-trainers

# Bonus pages with unclear purpose
/pages/bonus/                         → evaluate each, likely delete all 4

# Video libraries (keep only react-player)
Remove: vidstack, react-video-js-player from package.json

# Moment.js → date-fns
Remove: moment, moment-timezone from package.json

# Outdated analytics (consolidate)
Remove: @openreplay/react, @openreplay/tracker-redux (expensive, separate decision)
Keep: @vercel/speed-insights (lightweight, useful)
```

### Consolidate (Don't Delete — Move + Merge)

```
/utils/utils.js (1000+ lines)          → split into utils/date.ts, utils/url.ts, utils/validation.ts
/helpers/events.ts                     → move to lib/socket/socketEvents.ts
/helpers/chatContext/                  → move to features/chat/ (if keeping)
/containers/                           → evaluate each, move to relevant feature or layout
```

---

## 9. Migration Phase Plan

### Phase 0 — Preparation (No Code Changes) [1 week]

- [ ] Audit all 56 page routes — document what each does
- [ ] Audit all 12 Redux slices — map which selectors each page uses
- [ ] Audit all 14 API files — list every endpoint
- [ ] Set up `nq-frontend` new repo alongside `nq-frontend-main`
- [ ] Install Next.js 14, configure TypeScript strict mode
- [ ] Configure ESLint + Prettier + Husky pre-commit hooks
- [ ] Set up Storybook for UI components (optional but recommended)

### Phase 1 — Foundation [1–2 weeks]

- [ ] Create App Router directory structure
- [ ] Write `middleware.ts` with auth + role guards
- [ ] Create `lib/redux/store.ts` with RTK Query baseApi
- [ ] Create `lib/redux/StoreProvider.tsx`
- [ ] Create root `app/layout.tsx` with all providers
- [ ] Migrate `auth.slice` → TypeScript, add proper types
- [ ] Migrate `SocketProvider` → `lib/socket/SocketProvider.tsx`
- [ ] Convert all socket event constants to TypeScript enums
- [ ] Create `useLocalStorage.ts` (SSR-safe)
- [ ] Create `utils/constants.ts` as single source of truth for routes/keys

### Phase 2 — Auth Feature [1 week]

- [ ] Migrate sign-in page → `app/(public)/auth/sign-in/page.tsx`
- [ ] Migrate sign-up page → `app/(public)/auth/sign-up/page.tsx`
  - Merge 3-step wizard into single route with step state
- [ ] Migrate forgot-password page
- [ ] Add `features/auth/auth.api.ts` with RTK Query endpoints
- [ ] Remove classic sign-in/sign-up pages (legacy duplicates)
- [ ] Test Google OAuth still works
- [ ] Move JWT token from localStorage → httpOnly cookie (security improvement)

### Phase 3 — Dashboard + Bookings [1.5 weeks]

- [ ] Create protected layout `app/(protected)/layout.tsx`
- [ ] Migrate Header component → TypeScript
- [ ] Migrate dashboard home page
- [ ] Add `features/bookings/bookings.api.ts` (RTK Query)
- [ ] Migrate booking card, booking list components → TypeScript
- [ ] Migrate upcoming sessions page
- [ ] Migrate rating modal → proper TypeScript types
- [ ] Migrate my-community page
- [ ] Migrate friends page

### Phase 4 — Schedule + Clips [1 week]

- [ ] Migrate `features/schedule/schedule.api.ts` (RTK Query)
- [ ] Migrate FullCalendar component with dynamic import
- [ ] Migrate `features/clips/clips.api.ts` (RTK Query)
- [ ] Migrate video upload page with proper loading states
- [ ] Remove duplicate slot-checking from both common slices

### Phase 5 — Video Conference [2 weeks]

> Most complex — do last so routing/state foundation is stable

- [ ] Migrate video page → `app/(protected)/meeting/page.tsx`
- [ ] Audit and consolidate 12 video hooks → keep 7 (remove redundancy)
- [ ] Migrate `callEngine.js` → TypeScript
- [ ] Migrate canvas drawing → dynamic import (Fabric.js is heavy)
- [ ] Migrate screenshot capture
- [ ] Migrate clip playback sync
- [ ] Test WebRTC handshake end-to-end
- [ ] Test socket events for lock mode, canvas sync
- [ ] Test recording functionality

### Phase 6 — Clean Up + Optimize [1 week]

- [ ] Remove moment.js, install date-fns, replace all usages
- [ ] Remove vidstack + react-video-js-player
- [ ] Consolidate 80+ SCSS files → CSS Modules per component
- [ ] Add Suspense boundaries + Skeleton loaders for all data-fetching pages
- [ ] Add `next/image` for all images
- [ ] Run bundle analyzer — fix any remaining large imports
- [ ] Add error boundaries per feature
- [ ] Remove all `console.log` debug statements
- [ ] Add proper error tracking (Sentry recommended)

### Phase 7 — QA + Deployment [1 week]

- [ ] Full regression testing of all routes
- [ ] Test role-based access (Trainer vs Trainee)
- [ ] Test video conferencing (WebRTC)
- [ ] Test socket events (canvas, clips, notifications)
- [ ] Test Stripe payment flow
- [ ] Test Google OAuth
- [ ] Performance audit (Lighthouse score target: 90+)
- [ ] Deploy to staging, verify env variables
- [ ] Deploy to production with feature flag or blue/green deploy

---

## 10. Timeline

```
Week 1    │ Phase 0  — Audit + preparation
Week 2    │ Phase 1  — Foundation (App Router, Redux, middleware)
Week 3    │ Phase 2  — Auth feature
Weeks 4–5 │ Phase 3  — Dashboard + Bookings
Week 6    │ Phase 4  — Schedule + Clips
Weeks 7–8 │ Phase 5  — Video Conference (2 weeks for complexity)
Week 9    │ Phase 6  — Clean up + optimize
Week 10   │ Phase 7  — QA + deployment
──────────┼─────────────────────────────────────────
TOTAL     │ 10 weeks (2.5 months) for 1 full-stack developer
           │  7 weeks for a 2-developer team
           │  5 weeks for a 3-developer team
```

**Critical path items that cannot be parallelized:**
1. Foundation (Phase 1) must complete before anything else
2. Auth (Phase 2) must complete before protected routes
3. Video (Phase 5) depends on Socket lib being complete (Phase 1)

**Items that can run in parallel (with 2+ devs):**
- Phase 3 (Dashboard/Bookings) + Phase 4 (Schedule/Clips) can overlap
- Phase 6 (cleanup) can start per-feature as features complete
- Documentation can be written throughout

---

## 11. Post-Migration Checklist

### Security
- [ ] JWT in httpOnly cookie (not localStorage) — prevents XSS token theft
- [ ] CSRF protection for auth endpoints
- [ ] Content Security Policy headers in `next.config.ts`
- [ ] Input sanitization for chat/message fields
- [ ] Rate limiting on auth endpoints (handled server-side)

### Performance Targets
- [ ] Lighthouse Performance ≥ 90
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3.5s
- [ ] Bundle size < 200KB gzip (initial JS)
- [ ] No render-blocking resources

### Code Quality
- [ ] TypeScript strict mode — zero `any` types
- [ ] ESLint passing — zero warnings
- [ ] All components have error boundaries
- [ ] All async operations have loading + error states
- [ ] No `console.log` in production

### Testing
- [ ] Unit tests for all utility functions (`utils/`)
- [ ] Unit tests for all Redux slices
- [ ] Integration tests for auth flow
- [ ] Integration tests for booking flow
- [ ] E2E test for video conference (Playwright)

### Monitoring
- [ ] Sentry for error tracking
- [ ] Vercel Speed Insights for performance
- [ ] Custom dashboard events tracked
- [ ] WebRTC quality metrics logged

---

## Quick Reference — Key Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Router | App Router (Next.js 14) | Server components, streaming, nested layouts |
| State (server data) | RTK Query | Auto-caching, invalidation, deduplication |
| State (UI/real-time) | Redux Toolkit | WebRTC and Socket.io state must be client-side |
| Auth guard | `middleware.ts` | Runs on Edge before render — no content flash |
| Date library | date-fns | Tree-shakeable, replaces 67KB Moment.js |
| Styling | CSS Modules per component | Co-located, no global namespace collisions |
| Video library | react-player only | Handles all clip formats, removes 2 redundant libs |
| Token storage | httpOnly cookie | Cannot be stolen via XSS |
| API client | RTK Query baseApi | Single source, automatic caching + refetching |
| TypeScript | Strict mode | Catches bugs at compile time |

---

*Document version: 1.0 — NetQwix Frontend Restructure Plan*
*Prepared: 2026-04-27*
*Author: Claude Code — Anthropic*
