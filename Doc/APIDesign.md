# API Design Document (Next.js Serverless Routes)

## 1. Authentication Routes (`/api/auth/[...nextauth]`)
Handled automatically by NextAuth.js credentials provider.
*   **POST** `/api/auth/callback/credentials` - Validates email/password against the User collection. Creates session token.

## 2. Trip Routes
*   **POST** `/api/trips`
    *   *Payload:* `{ name, destinationQuery, startDate, endDate }`
    *   *Action:* Creates a new trip, generates a 6-char `roomCode`, sets creator as member.
*   **GET** `/api/trips`
    *   *Action:* Returns all trips associated with the logged-in user's `tripIds`.
*   **POST** `/api/trips/join`
    *   *Payload:* `{ roomCode }`
    *   *Action:* Adds the logged-in user to the trip's `members` array.
*   **GET** `/api/trips/[id]`
    *   *Action:* Returns full trip details, including populated member data, budget, and milestones.

## 3. Expense Routes
*   **POST** `/api/expenses`
    *   *Payload:* `{ tripId, amount, description, splitType, includedMembers, splitDetails }`
    *   *Action:* Adds an expense to the ledger.
*   **GET** `/api/expenses?tripId=[id]`
    *   *Action:* Fetches the ledger feed for a specific trip.
*   **DELETE** `/api/expenses/[id]`
    *   *Action:* Undoes/removes an expense (restricted to the creator of the expense).

## 4. Offline Sync Endpoint (Batch Processing)
*   **POST** `/api/sync`
    *   *Payload:* `{ offlineActions: [ { type: 'CREATE_EXPENSE', payload: {...} }, { type: 'CLAIM_GEAR', payload: {...} } ] }`
    *   *Action:* When `navigator.onLine` fires, Dexie.js sends the `pending_sync_queue` here. The server processes the array of actions in a single transaction and returns the updated state to align the client.