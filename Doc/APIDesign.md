# API Design Document (Next.js Serverless Routes)

**Project:** TripSplit  
**Version:** 1.0.0  
**Architecture:** Next.js 16 App Router (Node.js & Turbopack Serverless Functions)  
**Authentication:** NextAuth.js v5 (Auth.js) Bearer JWT Session Tokens  
**Security:** Edge Proxy Rate Limiting via `proxy.ts`

---

## 1. Authentication & Security Routes

### 1.1 User Registration
* **`POST /api/register`**
  * **Headers:** `Content-Type: application/json`
  * **Payload:**
    ```json
    {
      "username": "AlexTraveler",
      "email": "alex@example.com",
      "password": "SecurePassword123",
      "avatarId": "avatar-fox.svg"
    }
    ```
  * **Action:** Hashes password with `bcryptjs` (salt rounds: 10), creates new User document, returns sanitised user profile.
  * **Status:** `201 Created` / `400 Bad Request` (Duplicate email or missing fields).

### 1.2 NextAuth Authentication
* **`POST /api/auth/callback/credentials`**
  * Handled by Auth.js credentials provider. Validates credentials, checks password hash, creates signed JWT session token.
* **`GET /api/auth/session`**
  * Returns active session payload. The session callback performs a live database lookup (`User.findById`) to automatically reject invalid or purged accounts.

### 1.3 Password Recovery
* **`POST /api/auth/forgot-password`**
  * **Payload:** `{ "email": "alex@example.com" }`
  * **Action:** Generates cryptographic reset token with a 1-hour expiration timestamp. Stores in user record and returns reset link.
* **`POST /api/auth/reset-password`**
  * **Payload:** `{ "token": "a8f9c...token", "password": "NewSecurePassword123" }`
  * **Action:** Validates token validity and expiration, hashes new password, clears reset token.

### 1.4 Rate Limiting Middleware (`proxy.ts`)
* Intercepts `POST` requests to `/api/register`, `/api/auth/forgot-password`, `/api/auth/reset-password`, and `/api/auth/callback/credentials`.
* Limit: **10 attempts per 5-minute sliding window per client IP**.
* Returns `429 Too Many Requests` with `Retry-After` header when limit exceeded.

---

## 2. Trip Management Routes

### 2.1 Create Trip
* **`POST /api/trips`**
  * **Payload:**
    ```json
    {
      "name": "Swiss Alps Expedition",
      "destinationQuery": "Interlaken, Switzerland",
      "startDate": "2026-12-10",
      "endDate": "2026-12-18",
      "currency": "EUR",
      "notes": "Basecamp chalet access code: 4492"
    }
    ```
  * **Action:** Generates unique 6-character room code (e.g. `ALP-8821`), sets creator as first member in `members` array, initializes empty budget document.
  * **Status:** `201 Created`.

### 2.2 List User Trips
* **`GET /api/trips`**
  * **Action:** Returns all trips where the authenticated user ID is present in `members` or `creatorId`. Populates member avatars and usernames.

### 2.3 Trip Details & Updates
* **`GET /api/trips/[id]`**
  * **Action:** Returns full trip document including populated `members` (`username`, `email`, `avatarId`). Verifies traveler membership.
* **`PATCH /api/trips/[id]`**
  * **Payload:** Partial trip updates `{ "name": "...", "notes": "...", "status": "completed" }`.
  * **Action:** Updates trip metadata (restricted to trip members or creator).

### 2.4 Join Trip via Room Code
* **`POST /api/trips/join`**
  * **Payload:** `{ "roomCode": "ALP882" }`
  * **Action:** Looks up trip by uppercase 6-char code, adds authenticated user to `members` array if not already present. Returns trip ID.

---

## 3. Collaborative Budget & Price Guessing Routes

### 3.1 Fetch Trip Budget
* **`GET /api/budget?tripId=[id]`**
  * **Action:** Returns the `Budget` document for the trip including `items`, `guesses`, `totalEstimated`, and `acknowledgments`. Populates guesser user profiles.

### 3.2 Add Budget Line Item
* **`POST /api/budget`**
  * **Payload:**
    ```json
    {
      "tripId": "654321...",
      "title": "Chalet Accommodation",
      "category": "Stay",
      "estimatedCost": 1200
    }
    ```
  * **Action:** Appends item to budget, recalculates total estimated trip ceiling.

### 3.3 Submit / Update Price Guess
* **`POST /api/budget/guess`**
  * **Payload:**
    ```json
    {
      "budgetId": "654321...",
      "itemId": "987654...",
      "amount": 1400,
      "notes": "Found a 4-bedroom chalet on Airbnb with sauna"
    }
    ```
  * **Action:** Records or updates the user's price guess on the item. Recomputes item consensus cost (statistical median/average across traveler guesses) and updates overall budget target.

### 3.4 Lock Agreed Price
* **`POST /api/budget/lock`**
  * **Payload:** `{ "budgetId": "...", "itemId": "...", "agreedCost": 1350 }`
  * **Action:** Locks line item (`isLocked: true`), sets official `agreedCost`, recalculates total estimated budget.

### 3.5 Acknowledge / Approve Trip Budget Share
* **`POST /api/budget/acknowledge`**
  * **Payload:** `{ "tripId": "654321..." }`
  * **Action:** Toggles the authenticated traveler's ID in the `acknowledgments` array. Returns updated count and approval status (`✓ Approved X/Y`).

---

## 4. Expense & Ledger Routes

### 4.1 Fetch Trip Expenses
* **`GET /api/expenses?tripId=[id]`**
  * **Action:** Returns all expenses associated with `tripId` sorted chronologically (`timestamp: -1`). Populates `paidBy` and `includedMembers` user fields.

### 4.2 Log New Expense
* **`POST /api/expenses`**
  * **Payload:**
    ```json
    {
      "tripId": "654321...",
      "amount": 90.00,
      "description": "Group Fondue Dinner",
      "category": "Food & Dining",
      "splitType": "equal",
      "includedMembers": ["user1_id", "user2_id", "user3_id"],
      "isPersonal": false
    }
    ```
  * **Action:** Persists expense to MongoDB, populates split shares, updates traveler ledger balances.

### 4.3 Edit Existing Expense
* **`PATCH /api/expenses/[id]`**
  * **Payload:** Updated fields `{ "amount": 110.00, "description": "Dinner + Drinks", "includedMembers": [...] }`.
  * **Action:** Updates expense document and recomputes all split shares. Allows toggling participants on or off.

### 4.4 Delete Expense
* **`DELETE /api/expenses/[id]`**
  * **Action:** Deletes expense record. Restricted to the expense payer or trip creator.

---

## 5. Task & Itinerary Routes

### 5.1 Fetch Trip Tasks & Logistics
* **`GET /api/tasks?tripId=[id]`**
  * **Action:** Returns all tasks, milestones, and packing items for the trip.

### 5.2 Create Task / Milestone / Gear
* **`POST /api/tasks`**
  * **Payload:**
    ```json
    {
      "tripId": "654321...",
      "type": "gear",
      "title": "Portable Camping Stove",
      "assignedTo": "user1_id",
      "targetDate": "2026-12-10"
    }
    ```
  * **Action:** Persists new task. Supported types: `'milestone'`, `'errand'`, `'gear'`.

### 5.3 Update Task / Claim Gear
* **`PATCH /api/tasks/[id]`**
  * **Payload:** `{ "isCompleted": true }` or `{ "assignedTo": "user2_id" }`.
  * **Action:** Updates task completion state or claims/unclaims gear.

### 5.4 Delete Task
* **`DELETE /api/tasks/[id]`**
  * **Action:** Deletes task document.

---

## 6. Offline Sync Route (Batch Reconciliation)

### 6.1 Batch Queue Sync
* **`POST /api/sync`**
  * **Headers:** `Content-Type: application/json`
  * **Payload:**
    ```json
    {
      "offlineActions": [
        {
          "type": "CREATE_EXPENSE",
          "payload": {
            "tripId": "654321...",
            "amount": 25.50,
            "description": "Trail Snacks",
            "category": "Food & Dining",
            "splitType": "equal",
            "includedMembers": ["user1_id", "user2_id"]
          }
        },
        {
          "type": "COMPLETE_TASK",
          "payload": { "taskId": "876543..." }
        }
      ]
    }
    ```
  * **Action:** Server processes queued actions in an atomic sequence, persists each entity, and returns reconciled state IDs to align the client Dexie.js cache.
  * **Status:** `200 OK`.
