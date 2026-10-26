# System Design Document
**Project:** Group Travel Organizer App
**Architecture Style:** Monolithic (Next.js App Router)
**Target Cost:** $0/month (Free-Tier Stack)

## 1. Core Tech Stack & Infrastructure
*   **Frontend & Backend:** Next.js (App Router). The UI and backend API routes exist in a single codebase.
*   **Hosting:** Vercel (Hobby Tier - Free). Handles Next.js API routes as serverless functions.
*   **Database:** MongoDB Atlas (M0 Sandbox - Free Tier). Provides 512 MB of NoSQL document storage.
*   **Authentication:** NextAuth.js (Auth.js). Local authentication connecting directly to MongoDB.
*   **Offline Storage Wrapper:** Dexie.js. A lightweight wrapper for IndexedDB to cleanly manage offline data queueing.

## 2. Media & Storage Constraints (Cost Optimization)
To prevent serverless timeout errors and ensure database storage limits are never exceeded:
*   **Zero Image Uploads:** The application strictly forbids direct file or image uploads to the server.
*   **Dynamic Trip Covers:** Trip cover images are fetched dynamically on the client side using the Unsplash API or Pexels API by passing the destination name as a search query.
*   **Preset Avatars:** Users select from a predefined grid of lightweight SVG/PNG preset avatars stored in the frontend `/public` folder.
*   **Trip Photos:** Handled exclusively via external URLs (e.g., pasting a Google Drive shared link into Shared Notes).

## 3. The Offline Sync Engine (Service Worker + Dexie.js)
1.  **Read State (Online):** App fetches MongoDB data and stores a localized copy in IndexedDB via Dexie.js.
2.  **Write State (Offline):** API calls are intercepted. Dexie.js saves the action (e.g., adding an expense) into a `pending_sync_queue` table. The UI updates instantly (Optimistic UI).
3.  **Restoration (Background Sync):** A Service Worker listens for `navigator.onLine`. When internet returns, it reads the `pending_sync_queue` and fires the REST API calls to the Next.js backend.

## 4. Directory Structure (Next.js App Router)
```text
/src
  /app
    /api                 # Backend Serverless Routes
      /auth              # NextAuth configuration
      /trips             # Trip CRUD operations
      /expenses          # Expense logging & settlement
    /(dashboard)         # Frontend UI: Master Dashboard
    /trip/[id]           # Frontend UI: Dynamic route for active trip
      /overview          # Tab 1
      /money             # Tab 2
      /plan              # Tab 3
      /tasks             # Tab 4
  /components            # Reusable React UI components
  /lib
    /db                  # MongoDB Mongoose connection
    /dexie               # Offline queue logic
  /public
    /avatars             # Static preset avatars

    ***

### 3. Database Design Document

```markdown
# Database Design Document (MongoDB / Mongoose)

## 1. User Collection
Stores persistent account data and links users to their trips.
*   `_id`: ObjectId
*   `username`: String
*   `email`: String (Unique)
*   `passwordHash`: String
*   `avatarId`: String (References a static frontend asset, e.g., 'avatar-fox.svg')
*   `tripIds`: Array of ObjectIds (References Trips)
*   `createdAt`: Date

## 2. Trip Collection
The core document housing trip metadata and member associations.
*   `_id`: ObjectId
*   `name`: String
*   `destinationQuery`: String (Used to fetch the Unsplash/Pexels background image)
*   `roomCode`: String (Unique 6-character alphanumeric code)
*   `creatorId`: ObjectId (References User)
*   `members`: Array of ObjectIds (References Users)
*   `status`: String (Enum: 'active', 'completed')
*   `startDate`: Date
*   `endDate`: Date

## 3. Expense Collection
Records all financial transactions for the ledger.
*   `_id`: ObjectId
*   `tripId`: ObjectId (References Trip)
*   `paidBy`: ObjectId (References User)
*   `amount`: Number
*   `description`: String
*   `splitType`: String (Enum: 'equal', 'exact', 'percentage')
*   `includedMembers`: Array of ObjectIds (References Users involved in this split)
*   `splitDetails`: Array of Objects `[{ userId, amountOwed }]` (For exact/percentage splits)
*   `timestamp`: Date
*   `isSynced`: Boolean (Used by Dexie.js offline engine)

## 4. Budget Collection
Tracks the estimated group budget vs. actuals.
*   `_id`: ObjectId
*   `tripId`: ObjectId (References Trip)
*   `items`: Array of Objects `[{ category, estimatedCost, addedBy }]`
*   `totalEstimated`: Number
*   `acknowledgments`: Array of ObjectIds (Users who have approved the current total)

## 5. Task & Milestone Collection (Optional Combined Schema)
Handles the Plan and Tasks tabs.
*   `_id`: ObjectId
*   `tripId`: ObjectId
*   `type`: String (Enum: 'milestone', 'errand', 'gear')
*   `title`: String
*   `assignedTo`: ObjectId (References User, nullable if unclaimed)
*   `isCompleted`: Boolean
*   `targetDate`: Date (For milestones)