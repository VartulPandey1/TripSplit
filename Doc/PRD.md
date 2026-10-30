# Product Requirements Document (PRD)

**Project:** TripSplit — Collaborative Group Travel Organizer & Budgeting PWA  
**Version:** 1.2.1  
**Platform:** Mobile-First Progressive Web App (PWA)  
**Tech Stack:** Next.js 16 (App Router + Turbopack), React 19, Tailwind CSS v4, MongoDB Atlas, NextAuth.js v5, Dexie.js (Offline IndexedDB Sync)  
**Target Cost:** $0/month (Free-Tier Stack)

---

## 1. Executive Summary

TripSplit is an offline-capable, mobile-first progressive web application designed to eliminate the logistical and financial friction of group travel. The platform unifies trip planning, collaborative price guessing, granular expense splitting, automated debt simplification, and shared checklists into a single cohesive, high-clarity interface.

Key value pillars:
1. **Pre-Trip Consensus**: Gamified price guessing and consensus median budgeting before making reservations.
2. **Dual Budget Ceilings**: Clear distinction between the group-agreed trip share and private personal out-of-pocket limits.
3. **Frictionless On-Trip Spending**: Granular participant toggling, equal/custom splitting, multi-currency formatting, and 100% offline functionality.
4. **Post-Trip Settlement**: Automated $O(N)$ debt minimization graph algorithm reducing group cash transfers to the minimum possible.

---

## 2. User Authentication & Security

* **Persistent Accounts**: Email and password authentication backed by MongoDB with salted bcrypt hashing.
* **Streamlined Onboarding**: Instant access upon registration without mandatory initial email verification blockers.
* **Password Recovery**: Secure forgot password and reset password token workflow with expiration timestamps.
* **Edge Proxy Rate Limiting**: Next.js 16 `proxy.ts` middleware enforces sliding-window IP limits (max 10 requests / 5 minutes) on authentication and password reset endpoints.
* **Session Invalidation**: NextAuth v5 JWT session callback validates active database existence to immediately reject ghost sessions if user records are purged.
* **Preset Avatars**: Flat-design SVG/PNG avatars selectable from predefined options to prevent external image upload costs.
* **Trip Invitation**: 6-character room codes (e.g., `ALP-8821`) generated per trip for frictionless member onboarding.

---

## 3. Core Technical Engine: Offline-First PWA

* **Installable PWA**: Configured with Web App Manifest (`public/manifest.json`), custom application icons (`icon.svg`, `icon-192.png`, `icon-512.png`), and standalone display mode.
* **Local IndexedDB Layer**: Powered by Dexie.js (`lib/dexie/db.ts`) with dedicated tables:
  * `cached_trips`: Offline access to trip metadata and member lists.
  * `cached_expenses`: Local offline expense ledger.
  * `pending_sync_queue`: Queue for offline mutations (`CREATE_EXPENSE`, `CLAIM_GEAR`, `COMPLETE_TASK`, `CREATE_TASK`).
* **Optimistic Local UI**: User mutations take effect on screen immediately (0ms latency).
* **Automatic Cloud Synchronization**: Background listener detects `navigator.onLine` and flushes the `pending_sync_queue` to the server via `/api/sync`, reconciling local state with MongoDB.

---

## 4. UI Architecture & Design System

### Design Philosophy: "Ethereal Sanctuary"
* **Primary Palette**:
  * Forest Sage: `#4a6454` (Primary actions, active states)
  * Muted Sage: `#7e9a88` (Labels, secondary accents)
  * Soft Mint: `#ccead5` (Highlights, approval tags, positive balances)
  * Deep Charcoal: `#1a1e1c` (Headings, primary metrics)
  * Silk Canvas: `#f7faf6` (Backgrounds, pill tabs)
* **Mobile Navigation**: Fixed bottom navigation bar with safe-area padding (`pb-safe`) ensuring touch controls never clash with iOS/Android system gesture bars.
* **Dev Indicator Optimization**: Repositioned Next.js dev indicator to `top-right` to preserve mobile tab ergonomics.

---

## 5. Application Views & User Journeys

### 5.1 The Master Dashboard
* **Dynamic Location Cover**: Destination photos fetched dynamically via the Unsplash API using destination query parameters, eliminating server storage costs.
* **Trip Hub**: Categorized list of active, upcoming, and completed trips with member avatars and room codes.
* **Quick Actions**: Prominent "+ Create New Trip" and "Join with Code" modal buttons.

### 5.2 The 4-Tab Trip View

#### Tab 1: Overview
* **Trip Banner**: Hero cover with trip dates, traveler count, and room code invitation pill.
* **Budget & Spending Status**: Clean card summarizing total budget health, amount spent, and per-person breakdown.
* **Quick Milestone**: Next scheduled itinerary stop with date and location tag.
* **Gear Status**: Overview of packed vs remaining community items.

#### Tab 2: Money (The Financial Hub)
* **Consensus Budget & Price Guessing Hub**:
  * Community price guessing game for expected expenditures (Stays, Flights, Dining, Activities).
  * Statistical median calculation across traveler guesses to establish realistic consensus.
  * One-click locking to convert consensus estimates into official budget targets.
* **Dual Personal Budget Targets**:
  1. **Trip Share Target**: Displays personal share of the collaborative group budget (`≈ Total / Members`) with 1-click group approval sign-off (`✓ Approved X/Y`).
  2. **Private Personal Target**: Allows travelers to set an independent spending ceiling visible only to them.
  * Both cards feature identical layouts: bold font-mono currency metrics, visual progress bars with `$0`, `50%`, and `Target Ceiling` ticks, and color-coded spent vs remaining badges.
* **Minimalist Budget & Spending Analytics**:
  * **Donut Health Ring**: Minimalist visual dial indicating percentage of target consumed.
  * **Paired Category Bars**: Side-by-side comparison of estimated budget vs actual spend.
  * **Traveler Contribution Matrix**: Net balance breakdown and individual spending contributions.
* **Live Expense Ledger**:
  * Real-time expense feed with category icons.
  * **Full Expense Editing**: Edit amount, description, payer, and included participants with automatic balance recalculations.
  * **Granular Participant Toggles**: Split equally or selectively among specific trip members.
* **Smart Settle-Up Engine**:
  * $O(N)$ debt minimization graph algorithm reducing complex group debts to the minimum possible direct payments.

#### Tab 3: Plan (Collaborative Logistics)
* **Milestone Timeline**: Chronological day-by-day itinerary of activities, arrival times, and locations.
* **Shared Notes & Codes**: Central text area for accommodation access codes, WiFi passwords, and flight numbers.

#### Tab 4: Tasks (Action Items & Gear)
* **Pre-Trip Errands**: Collaborative to-do list with member assignments and completion checkboxes.
* **Smart Packing Checklist**: Master packing list categorizing community vs individual gear with claim/unclaim toggles.

---

## 6. Multi-Currency Support

* Supported Currencies: `USD` ($), `EUR` (€), `GBP` (£), `INR` (₹), `CAD` (CA$), `AUD` (A$), `JPY` (¥).
* Currency selection occurs during trip creation and formats all ledger entries, targets, and settlements automatically across the trip workspace.

---

## 7. Future Roadmap

### V1.1 (Short-Term)
- Real-time exchange rate conversions via OpenExchangeRates API.
- Export expense ledger and settle-up reports to CSV / PDF.

### V1.2 (Mid-Term)
- Receipt OCR scanning powered by Gemini Vision API to parse itemized restaurant bills.
- Push notifications for new budget guesses, expense logs, and settle-up requests.
