# Changelog

All notable changes to the **TripSplit** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.1] - 2026-10-27

### 🐛 Fixed
- **Overview Total Spend Excludes Private Spends**: Fixed `app/trip/[id]/overview/page.tsx` including personal expenses in the trip's collective total spend. Strictly filtered out `isPersonal` and `splitType === 'personal'`, keeping Overview and Money dashboard numbers in sync.
- **Dynamic International Currency Locales**: Fixed `lib/utils/currency.ts` hardcoding Indian numbering (`en-IN`) which caused foreign currencies like USD and EUR to display with lakhs/crores grouping (e.g. `$1,00,000.00`). Added dynamic mapping to appropriate international locales (`en-US`, `en-GB`, `en-CA`, `ja-JP`, etc.) with zero-decimal handling for JPY.
- **Service Worker & PWA App Shell Caching**: Added `public/sw.js` and registered it in `OfflineSyncManager.tsx` to pre-cache the critical app shell, manifest, and icons, preventing the "No Internet" screen and enabling seamless offline reloads.
- **Debounce Race Condition in Shared Notes**: Fixed `app/trip/[id]/plan/PlanClient.tsx` dropping user keystrokes when debounce timers fired while a previous save was in-flight. Introduced an internal queue mechanism (`isSavingRef` and `pendingSaveRef`) that guarantees every keystroke is saved to MongoDB.
- **Personal Budget Default Cleanup**: Removed arbitrary hardcoded default personal budget of 5,000 in `app/trip/[id]/money/UserExpenseBudgetSection.tsx`, defaulting to 0 when no group budget exists.
- **Brute-Force Rate Limiting on Trip Join**: Added `/api/trips/join` to `proxy.ts` and introduced direct durable rate limiting in `app/api/trips/join/route.ts` (max 10 attempts per 5 minutes per IP/user) to prevent brute-forcing 6-character room codes.
- **Offline Queue Isolation & Logout Purge**: Added `userId` scoping to `PendingSyncAction` in `lib/dexie/db.ts` and implemented `clearLocalDatabase()` upon logout via a new `SignOutButton` component in `app/dashboard/page.tsx`, preventing cross-account queue leaks on shared devices.
- **Guarded Price Guessing on Locked Budget Items**: Added guard in `app/api/budget/guess/route.ts` returning a 400 error if members attempt to submit price guesses on items already locked to an agreed cost (`isLocked: true`).
- **Payer ID String vs. Object ID Comparison**: Fixed `UserExpenseBudgetSection.tsx` and `BudgetSpendingAnalytics.tsx` comparing `exp.paidBy?._id === currentUserId`, which failed when `paidBy` was an unpopulated string ID. Corrected to extract string IDs safely and accurately identify the payer.

---

## [1.1.0] - 2026-10-27

### 🚀 Added
- **Leave Trip & Delete Trip Capabilities**:
  - Secure departure endpoint (`POST /api/trips/[id]/leave`) validating trip membership and financial balance; members with unsettled balances (owing or owed money) are blocked with descriptive error messages.
  - Cascading trip deletion (`DELETE /api/trips/[id]`) for trip creators, removing all associated expenses, budgets, tasks, and user trip references in MongoDB.
  - Interactive Leave Trip and Delete Trip modals in `TripHeaderCard.tsx` with confirmation safeguards.
- **Unequal & Custom Split Modes (Exact & Percentage)**:
  - Added support for custom expense allocations: **Equal**, **Exact Amounts**, and **Percentage Split**.
  - Real-time balance checker validating that exact allocations equal the total expense amount or percentage allocations equal 100%.
  - Full persistence of `splitType` and `splitDetails: [{ userId, amountOwed }]` in Mongoose and client state.
- **Receipt Photo Attachment & Full Viewer**:
  - Travelers can snap or upload receipt images directly when logging or editing expenses.
  - Client-side Canvas image compression (resizing to max 900x900px at 0.75 JPEG quality) keeping payloads under ~50KB for zero-cost MongoDB storage.
  - Ledger receipt indicators (`📷 Receipt`) and dedicated high-resolution receipt photo viewer modal.
- **Lock & Restrict Settlement Entries in Ledger**:
  - Debt settlements are rendered in the ledger as read-only transfer receipts with distinct `[Transfer]` badges.
  - Standard Edit modal is disabled on settlement records to prevent ledger corruption; clear read-only details and deletion safeguards provided.
- **Export Trip Summary (CSV)**:
  - Added an **Export Report** button on the Money tab generating and downloading an itemized CSV summary.
  - Includes trip metadata, member net balances and settlement statuses, itemized shared expenses with split breakdowns and receipt flags, and settlement transaction logs.
- **Gear Quantity Counter**:
  - Added a quantity counter for shared gear items (e.g. "Tents × 2", "Power Banks × 3") with inline input selectors and +/- stepper controls.
- **Read-Only Task Archive on Trip Completion**:
  - Automatically locks checklists and errands when `trip.status === 'completed'` (or `new Date() > trip.endDate`), archiving tasks while keeping financial settle-up accessible.
- **User Profile & Password Change Settings**:
  - New `/settings` page allowing users to update their avatar emoji (Fox 🦊, Panda 🐼, Bear 🐻, Cat 🐱, Owl 🦉, Tiger 🐯), update display username, and change account passwords with current password verification.
  - Added `app/api/user/profile/route.ts` and `app/api/user/password/route.ts`.
  - Added Settings shortcut with avatar link in dashboard top navigation.
- **Resilient Per-Item Offline Queue Sync**:
  - Enhanced `lib/dexie/db.ts` and `lib/dexie/sync.ts` to only delete items from IndexedDB that received `success: true` from `/api/sync`.
  - Failed mutations are retained in IndexedDB with error messages and retry counters.
  - Floating `OfflineSyncManager.tsx` banner monitoring `navigator.onLine`, showing offline status, sync progress, and one-click retry for failed actions.

---

## [1.0.1] - 2026-10-27

### 🐛 Fixed
- **Inverted Date Range Validation**: Enforced strict `startDate <= endDate` validation on both client (`app/trips/new/page.tsx`) and backend API routes (`app/api/trips/route.ts`, `app/api/trips/[id]/route.ts`), returning descriptive 400 errors for inverted dates.
- **Trip Date Persistence in Update API**: Fixed `PATCH /api/trips/[id]` silently discarding `startDate` and `endDate` fields in request payloads; added validation and full persistence to MongoDB.
- **Trip Auto-Completion Lifecycle**: Fixed trips never transitioning out of `'active'` status after their end dates. Implemented `autoUpdateExpiredTrips()`, Mongoose pre-save hooks, and `getTripStatus()` resolution across Dashboard, Overview, and API routes.
- **Whitespace-Only Trip Names**: Fixed bug where entering spaces for trip titles bypassed truthy checks. Enforced `.trim()` validation in frontend forms, API route handlers, and Mongoose schema rules (`trim: true, minlength: 1`).
- **Dynamic Date Picker Constraints**: Added dynamic `min={form.startDate}` to the End Date picker and `max={form.endDate}` to the Start Date picker, preventing users from selecting impossible dates in native calendars, with automatic end-date bump when start date moves forward.

---

## [1.0.0] - 2026-10-27

### 🚀 Added
- **Collaborative Group Trips**:
  - Trip creation with destination photo integration via Unsplash API.
  - 6-character room codes (e.g., `ALP-8821`) for frictionless traveler invitations.
  - Multi-currency support with dynamic symbol formatting (`USD`, `EUR`, `GBP`, `INR`, `CAD`, `AUD`, `JPY`).
- **Collaborative Budget & Price Guessing Hub**:
  - Group price guessing game allowing all travelers to submit estimates before booking.
  - Consensus algorithm computing median estimate across traveler guesses.
  - One-click price locking to solidify estimates into official trip budget items.
- **Dual Personal Budget Targets**:
  - **Trip Share Target**: Displays your per-person share of the collective trip budget with 1-click group approval status (`✓ Approved X/Y`).
  - **Private Personal Target**: Set an independent, private spending ceiling visible only to you.
  - High-clarity visual progress tracks with `$0`, `50%`, and `Target Ceiling` ticks plus color-coded remaining/over-budget meters.
- **Advanced Expense Splitting & Editing**:
  - Full Expense Edit modal with dynamic participant toggle (split equally or selectively among specific members).
  - Categorization engine (Flights, Stays, Food, Activities, Transport, Shopping).
  - Real-time spend calculations updating across all trip dashboards.
- **Smart Settle-Up Engine**:
  - Graph-based debt simplification algorithm reducing total transactions to $O(N)$ transfers.
  - Visual settlement breakdown indicating exactly who pays whom with zero redundant handoffs.
- **Minimalist Budget & Spending Analytics**:
  - Donut Budget Health ring with real-time percentage consumed.
  - Paired Bar chart comparing estimated category budgets against actual spend.
  - Traveler contribution breakdown showing net balances and spending shares.
- **Collaborative Trip Itinerary & Task Planning**:
  - Day-by-day itinerary builder with activity times, locations, and traveler assignments.
  - Shared packing checklist and task manager with completion toggles.
- **Offline-First PWA & Background Sync**:
  - Local IndexedDB storage powered by Dexie.js for full offline capability on flights or remote trails.
  - Automated cloud sync queue reconciling local mutations with MongoDB when connection restores.
  - Installable Progressive Web App (PWA) manifest with custom SVG and PNG app icons.
- **Security & Rate Limiting**:
  - Edge proxy rate limiting on authentication and password reset endpoints via `proxy.ts`.
  - Secure credential hashing using `bcryptjs`.
  - NextAuth v5 JWT session invalidation with live database existence checks to prevent ghost sessions.

### ⚡ Changed
- **Next.js 16 Upgrade & Turbopack Compatibility**:
  - Migrated legacy `middleware.ts` to the Next.js 16 `proxy.ts` convention.
  - Removed deprecated `export const dynamic = 'force-dynamic'` routes conflicting with `cacheComponents`.
  - Configured Dev Indicator position to `top-right` preventing interference with mobile navigation bars.
- **Minimalist UI & Navigation**:
  - Adopted the "Ethereal Sanctuary" design palette (deep charcoal `#1a1e1c`, forest sage `#4a6454`, muted sage `#7e9a88`, soft mint `#ccead5`).
  - Streamlined action buttons across all views to eliminate redundant duplicate "+ Add" triggers.
  - Symmetrical card redesign matching typography, buttons, and progress tracks between Trip Share and Personal Allowance cards.

### 🐛 Fixed
- **Database User Invalidation**: Fixed ghost JWT sessions persisting after user records were purged from MongoDB.
- **Mongoose Strict Population**: Resolved TypeScript compile errors when populating nested user arrays across Trip and Budget schemas.
- **Expense Participant Toggle**: Fixed issue where removing a participant from an existing expense did not recompute remaining member split shares.
- **Mobile Bottom Navigation**: Eliminated layout shift on iOS Safari by configuring proper viewport safe area insets.

---

## [Unreleased]
- Future multi-currency real-time conversion ticker.
- Receipt OCR scanning using Gemini Vision API.
- Export trip expense report to PDF / CSV.
