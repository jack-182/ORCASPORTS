# Security Specification — ORCA Conecta Sports

## 1. Data Invariants
1. **PII Isolation**: User emails and private preferences are stored strictly in `users_private/{userId}` and readable/writable only by the owning verified user (`request.auth.uid == userId`). Public `users/{userId}` documents contain zero PII.
2. **Identity Integrity**: Every created `events`, `groups`, `conversations`, `messages`, `friendships`, and `notifications` document must bind its creator/sender field (`hostId`, `ownerId`, `createdBy`, `senderId`, `requesterId`) to `request.auth.uid`.
3. **Immutable Ownership & Timestamps**: `createdAt`, `uid`, `hostId`, `ownerId`, `createdBy`, `senderId`, and `requesterId` cannot be altered after creation. All `createdAt` / `updatedAt` timestamps must equal `request.time`.
4. **Master Gate & Atomicity**: Joining/leaving an event in `events/{eventId}/participants/{uid}` checks the parent event state and coordinates with `events/{eventId}` updates. Creating messages in `conversations/{convId}/messages/{messageId}` verifies membership in parent `conversations/{convId}`.
5. **Terminal State Locking**: Once an event reaches `status == 'cancelled'` or `status == 'completed'`, non-admin mutations are blocked.
6. **Verified Users Only**: All writes require `request.auth != null && request.auth.token.email_verified == true`.

## 2. Dirty Dozen Attack Payloads (Expected: PERMISSION_DENIED)
1. **Ghost Field / Shadow Update on `users`**: `{ "uid": "u1", "verified": true, "isAdmin": true }` — rejected by `hasOnly` and `verified == false` lock on create / immutable check on update.
2. **Identity Spoofing on `events`**: `{ "hostId": "other_user", "title": "Fake", ... }` — rejected because `hostId != request.auth.uid`.
3. **ID Poisoning on `events/{eventId}`**: Document ID of 500 characters or containing spaces/slashes — rejected by `isValidId(eventId)`.
4. **PII Snooping on `users_private/{otherUid}`**: `get` by authenticated non-owner — rejected by `isOwner(userId)`.
5. **Unauthenticated / Unverified Write**: Write with `email_verified == false` — rejected by `isVerifiedUser()`.
6. **Client Timestamp Forgery**: `{ "createdAt": "2020-01-01T00:00:00Z" }` — rejected because `createdAt != request.time`.
7. **Terminal Event Mutation**: Updating `title` or `participantsCount` on an event with `status == 'cancelled'` — rejected by terminal state lock.
8. **Cross-Conversation Message Injection**: Writing to `conversations/c1/messages/m1` when user is not in `conversations/c1.memberIds` — rejected by Master Gate `get()`.
9. **Direct Chat Scraping (`allow list`)**: Listing `conversations` without being in `memberIds` — rejected by `request.auth.uid in resource.data.memberIds`.
10. **Oversized String / Resource Exhaustion**: `text` with 5,000 characters in `messages` — rejected by `.size() <= 1000`.
11. **Unbounded Array Injection**: `favoriteSports` with 50 items — rejected by `.size() <= 8`.
12. **Notification Spoofing / Foreign Read**: Reading `notifications/{id}` where `recipientId != request.auth.uid` — rejected by owner-only read & list enforcement.
