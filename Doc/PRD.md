# MVP Product Requirements Document (PRD)
**Project:** Group Travel Organizer App 
**Platform:** Mobile-First Progressive Web App (PWA)
**Tech Stack:** Next.js (App Router), MongoDB Atlas, Dexie.js (Offline Sync)
**Target Cost:** $0/month

## 1. Executive Summary
A collaborative, offline-capable web application designed to eliminate the financial and logistical friction of group travel. The app provides a transparent ledger for granular expense splitting, a collaborative budget planner, and shared checklists, ensuring all group members are aligned.

## 2. User Authentication & Onboarding
*   **Persistent Accounts:** Users sign up using an email, password, and username. 
*   **Frictionless Entry:** No email verification or OTP is required to start using the app in V1.
*   **Preset Avatars:** Users select from a grid of predefined flat-design avatars (no custom image uploads).
*   **Trip Invitation:** A Trip Creator generates a unique 6-character code (e.g., `TRP987`). Friends log in, enter the code, and instantly join the shared session.

## 3. Core Technical Requirement: PWA & Offline Engine
*   **Offline Availability:** Installable on mobile home screens via the browser.
*   **Local Caching:** UI assets are cached via Service Workers.
*   **Offline Data Queue:** When offline, logged expenses and tasks are saved locally in the browser using Dexie.js (IndexedDB).
*   **Auto-Sync:** Upon network restoration (`navigator.onLine`), the app automatically pushes queued data to the MongoDB backend.

## 4. UI Architecture & Navigation
### The Master Dashboard (Post-Login)
*   **Immersive Location Header:** The dashboard features dynamic, edge-to-edge cover photos of trip destinations, fetched in real-time via Unsplash/Pexels API to provide a premium visual experience without consuming backend storage.
*   **Trip Hub:** Displays all active, upcoming, and past trips as clickable cards.
*   **Quick Actions:** "+ Create New Trip" and "Join with Code" buttons.

### The 4-Tab Trip View (Inside an Active Trip)
*   **Tab 1: Overview (The Dashboard)**
    *   **Financial Status:** Large display of the user's personal remaining budget and the group's overall budget health ring.
    *   **Action Needed:** Dynamic alerts for pending budget acknowledgments or unpaid debts.
    *   **Next Milestone & Gear:** Quick view of the immediate next itinerary stop and the user's claimed packing items.
*   **Tab 2: Money (The Finance Hub)**
    *   **Collaborative Budget:** Establish expected costs. Triggers an "Acknowledgment Request" if the baseline increases.
    *   **The Ledger:** A live feed of every logged expense.
    *   **Granular Splitting:** Split expenses equally, by exact amounts, or exclude specific members.
    *   **Settle Up:** A final calculator using a debt-simplification algorithm to minimize peer-to-peer transfers.
*   **Tab 3: Plan (Logistics)**
    *   **Milestone Timeline:** A vertical, chronological checklist of trip destinations and goals.
    *   **Shared Notes:** Text area for gate codes, basecamp addresses, and important links.
*   **Tab 4: Tasks (Action Items)**
    *   **Pre-Trip Errands:** Group to-do list (e.g., "Book bikes").
    *   **Smart Packing Checklist:** Master gear list where users claim responsibility for specific items.

## 5. Future Roadmap (V2 & V3)
*   **V2:** Multi-currency support, Google Drive photo grid integration, dedicated voting board, and private spending insights.
*   **V3:** "Mark as Departed" functionality for mid-trip dropouts, Google OAuth, and email verification.