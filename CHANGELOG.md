# Changelog

All notable changes to the **TripSplit** project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.6] - 2026-10-28

### 📱 Bottom Nav Active Indicator, Touch-Manipulation & Skeleton Shimmers
- **OLED Bottom Nav Active Indicator & Soft Ambient Glow**:
  - Anchored a 3px rounded indicator pill (`#4a6454` with soft glow shadow) above the active bottom nav tab icon.
  - Added a soft ambient green glow halo (`rgba(74, 100, 84, 0.08)` and `14px` blur) behind the active icon, providing clear visual confirmation on OLED mobile displays.
- **Prevent Accidental Double-Tap Zoom**:
  - Added `touch-manipulation` and `select-none` to all interactive pills and quantity steppers (`+`, `-`, `Volunteer/Claim`, `Copy Code`, `Copy Link`, tab toggles, and FAB buttons).
  - Applied global `touch-action: manipulation;` across buttons and action roles in `app/globals.css`, eliminating unwanted mobile Safari double-tap zooming during rapid clicking.
- **Skeleton Shimmer Loading**:
  - Replaced the static `"Loading trip details…"` text with subtle pulsing gray card skeletons (`OverviewSkeleton`) mirroring the actual card shapes (Header Card, Next Stop, Tasks & Gear, and Analytics).
  - Added corresponding card-shaped shimmer skeletons for Checklists (`TasksSkeleton`), Finances (`MoneySkeleton`), and Itinerary (`PlanSkeleton`), delivering an instantaneous perceived load experience.

---

## [1.1.5] - 2026-10-27

### 📋 1-Tap "Paste code from clipboard" & 1-Second Auto-Submit
- **1-Tap Paste Button on Join Trip Portal**:
  - Added dedicated one-tap button: `"📋 Paste code from clipboard"` on `/trips/join`.
  - Intelligently parses raw text, WhatsApp share messages, invite links (`?code=...`), and direct 6-character room codes.
  - Automatically populates the room code input and triggers auto-submit after a 1-second visual countdown with animated progress bar and confirmation badge.
  - Allows manual cancellation if edited or immediate submission without waiting.
- **Enhanced Direct Input Paste**:
  - Added smart clipboard extraction to input `onPaste` handler, preventing URLs or full WhatsApp messages from being truncated to 6 characters.

---

## [1.1.4] - 2026-10-27

### 🎒 1-Tap Quick Claim & Compact Quantity Badges
- **1-Tap Quick Claim on Mobile & Desktop**:
  - Unassigned gear items and pre-trip tasks now feature a subtle, high-affordance `+ Volunteer` pill directly on the row.
  - Any travel crew member can instantly claim responsibility for an item with a single tap directly from the checklist feed without having to tap into the edit bottom sheet and change assignees.
  - Once claimed, the item smoothly transitions to "Claimed by You", unlocking the checkbox so the volunteer can check it off as packed/completed.
- **Compact Quantity Badges**:
  - Relocated gear quantity indicators (e.g. `2x`, `3x`) from the end of the title text into a sleek, dedicated pill badge positioned right next to the checkbox.
  - Prevents long item titles from wrapping awkwardly onto new lines due to appended quantity strings.
  - Added consistent compact quantity pill rendering to the Overview tab's open and claimed task feeds.

---

## [1.1.3] - 2026-10-27

### 📝 Dedicated Full-Height Apple Notes-Style Canvas & Itinerary Time Badges
- **Dedicated Full-Height Notes View**:
  - Expanded the Trip Notes canvas to a comfortable `h-[55vh]` viewport height on mobile (`h-[60vh]` on desktop), providing a distraction-free notepad for Wi-Fi codes, flight PNRs, booking links, and gate passwords.
  - Implemented a sticky sync status bar anchored to the bottom displaying real-time synchronization (`✓ Auto-saved to trip`, `Auto-saving in Xs…`, `Offline pending sync`) alongside manual immediate save and word count metrics.
- **Mobile Responsive Stop Time Badges**:
  - On mobile screens, scheduled stop activity times (e.g. `⏰ 10:30 AM`) now render as a subtle pill below the stop title rather than competing horizontally against the title text, preventing awkward text truncation on narrow viewports.

### 💸 Money Screen UX Redesign & Apple Wallet-Style Financial Rows
- **Brand New Trip Zero-State Simplicity**:
  - When no expenses have been recorded yet (`expenses.length === 0`), the Expenses screen now renders a clean, centered `"No expenses logged yet"` zero-state card with a single `+ Log First Expense` button.
  - Automatically hides sub-tab pills (`Personal`, `Group Ledger`, `Private Spends`), search bars, and KPI cards until data exists to filter.
- **Unified 1-Line Financial Ticker**:
  - Replaced tall multi-card metric boxes with a sleek, single-line header ticker: `Total: <Amount> • You owe: -<Amount>` (or `You get: +<Amount>` / `✓ All squared up`).
- **Single Primary Add Button (Duplicate Removal)**:
  - Consolidated expense entry into strictly **ONE** primary Add button in the top bar.
  - Removed duplicate "+ Add Expense" / "+ Add Private" buttons from the inner card headers and eliminated the overlapping bottom floating action button (FAB).
- **Apple Wallet-Style 2-Line Financial Rows**:
  - Personal share transactions now follow a 2-line financial format:
    - **Line 1**: `Description` (bold left) ................ `-<Amount>` / `+<Amount>` (bold red/green right)
    - **Line 2**: `Paid by <Payer> • 1 of <Count>` (subtle left) ... `to pay` / `to get` (subtle red/green right)
  - Removed heavy emoji icon boxes (`w-9 h-9` squares) and multi-line avatar badges from rows for a cleaner ledger appearance.
- **Strict Tab Boundaries**:
  - Confined all budget targets, category limits, and guessing games strictly to the Budget tab, keeping the Expenses tab purely focused on transactions and Settle Up.

---

## [1.1.2] - 2026-10-27

### 🎨 Clean Tab-Driven Financial Cards & Dynamic Subview Switching
- **Single Contextual KPI Card**: Replaced the static dual-card grid under Expenses with a single, high-clarity contextual card that updates dynamically based on the active tab:
  - **Group Ledger Tab**: Displays **Total Group Expenses** with collective spend across all members, total shared entries count, and your upfront contribution.
  - **Personal Balance Tab**: Displays **Your Net Balance** with bold color-coded financial standing (owed vs owe vs squared up), plain-English explanations, and To Pay / To Get totals.
  - **Private Spends Tab**: Displays **Your Private Spends** with solo out-of-pocket totals, privacy guarantees, and private target progress tracking.
- **Top-Level Intuitive Navigation Tabs**: Elevated subview tabs (`Personal Balance`, `Group Ledger`, `Private Spends`) to the top of the Expenses section, ensuring clear visual hierarchy and eliminating redundant nested headers.
- **De-cluttered List Containers**: Standardized clean transaction feeds across all three expense subviews without repeated metric banners.

---

## [1.1.1] - 2026-10-27

### 🎨 Mobile UX & Layout Optimization
- **Touch-Optimized Expense Ledger**: Replaced bulky inline action buttons in mobile expense lists with touch-friendly disclosure indicators (`›`); tapping an expense row on mobile triggers the comprehensive detail and action sheet, while desktop viewports retain inline quick-action controls.
- **Responsive Financial KPI Cards**: Optimized padding, font scaling, and secondary text visibility on mobile viewports for Total Spend and Net Position cards, eliminating awkward text clipping on small screens.
- **Adaptive Navigation Pills**: Streamlined tab pill labels for Personal, Group Ledger, and Private Spend toggles (`Personal` vs `Personal Expense`) to guarantee fit on narrow mobile devices.
- **Compact Overview Responsibilities**: Implemented responsive badges and streamlined action buttons (`Tasks →` and `Claim`) for assigned and unclaimed group logistics in the Overview tab.
- **Event Propagation Hardening**: Added `stopPropagation()` to inline delete and edit action triggers to prevent unwanted row-tap sheet collisions.

---

## [1.0.1] - 2026-10-27

### 🐛 Fixed
- **GitHub Markdown Mermaid Render Compatibility**: Fixed syntax parse error in `README.md` flowchart subgraph declaration (`subgraph G2 ["Settle-Up Minimization O(N)"]`), eliminating unquoted parenthesis token collision (`got 'PS'`) on GitHub's native Mermaid markdown parser.
- **Architectural Flowchart Subgraph IDs**: Enhanced `Doc/SystemDesign.md` with explicit node identifiers on all client and serverless edge diagram subgraphs.

---

## [1.0.0] - 2026-10-27

### 🚀 Initial Major Release (v1.0.0)

TripSplit is an offline-capable, collaborative travel organizer, consensus budgeting hub, and smart expense splitting progressive web app (PWA) built with Next.js 16, React 19, Tailwind CSS v4, MongoDB Atlas, NextAuth v5, and Dexie.js.

### 🌟 Features Added
- **Multi-User Authentication & Profile Management**:
  - Secure credential registration and login backed by MongoDB and salted `bcryptjs` password hashing.
  - Profile customization page (`/settings`) allowing avatar customization (Fox 🦊, Panda 🐼, Bear 🐻, Cat 🐱, Owl 🦉, Tiger 🐯), display username updates, and password rotation.
  - Password recovery workflow (`/forgot-password` and `/reset-password`) with time-limited cryptographic reset tokens.
  - Active session invalidation verifying database existence to prevent ghost sessions on purged accounts.
  - Edge proxy rate limiting on authentication routes via `proxy.ts` (10 requests per 5 minutes per IP).

- **Collaborative Group Trips & Membership**:
  - Interactive trip creation with destination querying, automatic end-date calendar constraints, and start/end range validation.
  - Unique 6-character room codes (e.g. `ALP-8821`) for instant member invites.
  - Automatic trip lifecycle transition (`active` vs. `completed`) based on real-time date evaluation.
  - Member departure endpoint (`POST /api/trips/[id]/leave`) preventing abandonment with active debts or receivables.
  - Cascading trip deletion (`DELETE /api/trips/[id]`) for trip creators, cleaning up all child documents.

- **Consensus Budget Guessing Hub**:
  - Gamified collaborative price guessing game allowing members to submit cost estimates for trip categories.
  - Statistical median consensus algorithm eliminating outlier price estimations.
  - One-click price locking to solidify agreed estimates into official trip budget line items.
  - Guarded against estimate submission on locked items.

- **Dual Personal Budget Targets**:
  - **Trip Share Target**: Displays each traveler's per-person share of the agreed group budget.
  - **Private Personal Target**: An independent, private spending ceiling visible only to the individual traveler, saved to MongoDB.
  - Symmetrical progress cards with zero, 50%, and target ceiling ticks, paired with color-coded remaining/over-budget meters.

- **Advanced Expense Ledger & Split Engine**:
  - Equal, Exact amount, and Percentage custom split modes with real-time total and balance checkers.
  - Granular participant toggle to include or exclude specific trip members on each expense.
  - Personal private expense toggle (`isPersonal`) keeping personal treats separate from the group ledger.
  - In-app receipt photo attachment with automated client-side canvas compression (<50KB) and high-resolution receipt modal viewer.
  - Multi-currency support with dynamic international formatting (`USD`, `EUR`, `GBP`, `INR`, `CAD`, `AUD`, `JPY`).

- **Smart Debt Simplification Graph Engine (Settle Up)**:
  - $O(N)$ greedy graph-reduction algorithm computing net balances and collapsing complex web of interpersonal debts into minimal peer-to-peer transfers.
  - Transfer settlement logging as read-only ledger transactions with distinct `[Transfer]` badges to preserve ledger integrity.
  - Itemized CSV export generating downloadable financial reports with member balances, split breakdowns, and transaction history.

- **Day-by-Day Timeline & Shared Logistics**:
  - Itinerary milestone scheduler with relative date indicators, time slots, and traveler assignments.
  - Shared gear packing lists with integer quantity steppers (`× 2`, `× 3`) and claim toggles.
  - Group errands checklist with assignment chips and completion toggles.
  - Automatic read-only task archiving when trips reach `completed` status.
  - Collaborative shared notes with queued debounce saves to eliminate keystroke loss.

- **Offline-First PWA Architecture**:
  - IndexedDB storage powered by Dexie.js for full offline capability on flights or remote trails.
  - Resilient per-item background synchronization queue with exponential retry counters.
  - Foreground `OfflineSyncManager` banner providing live connectivity status and manual retry triggers.
  - Native Progressive Web App (PWA) manifest and Service Worker pre-caching the core app shell.
  - Automatic Dexie local database purge on sign-out to prevent data leakage on shared devices.

### 🛡️ Security & Reliability
- Next.js 16 Edge proxy rate limiting on auth endpoints (`proxy.ts`).
- Server-side sliding-window rate limit on `/api/trips/join` to prevent room-code enumeration.
- Strict input validation: non-whitespace trip names, chronological date validation, and positive amount validation.
- Mongoose singleton connection handler optimized for serverless environments.

---

## [Unreleased]
- PDF expense and settle-up summary generation.
- Real-time exchange rate updates via OpenExchangeRates API.
- Receipt OCR scanning powered by Gemini Vision API.
- Push notifications for trip updates and settlement requests.
