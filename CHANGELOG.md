# Changelog

All notable changes to the **TripSplit** project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
