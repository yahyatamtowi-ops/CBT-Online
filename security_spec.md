# Firestore Security Specification (Phase 0 — Payload-First Security TDD)

## 1. Data Invariants

1. **Default Deny**: All unspecified paths under `/databases/{database}/documents` are denied for read and write.
2. **Verified Authentication**: Every read and write operation requires an authenticated Firebase user with `request.auth.token.email_verified == true`.
3. **Master Gate (Relational Ownership)**: Every subcollection record (`students`, `teachers`, `packages`, `attempts`) under `/cbt_snapshots/{snapshotId}` requires the parent `/cbt_snapshots/{snapshotId}` document to exist and belong to `request.auth.uid` (or verified admin).
4. **Identity Integrity & Anti-Spoofing**: Incoming `ownerUid` must strictly match `request.auth.uid` on create and remain immutable on update. Admin bootstrap checks both `request.auth.token.email == 'tamtowiyahya65@gmail.com'` AND `request.auth.token.email_verified == true`.
5. **Strict Schema & No Shadow Fields**: Every write validates keys via `hasAll` + `hasOnly` on create and `affectedKeys().hasOnly(...)` on update, with explicit type checks and `.size()` bounds on every string and array.
6. **Temporal Integrity**: `createdAt == request.time` on create and immutable on update; `updatedAt == request.time` on create and update.
7. **Terminal State Locking**: Once an `AttemptSummaryDoc` reaches `status == 'completed'`, non-admin updates are strictly rejected.
8. **Secure List Queries**: Every `allow list` rule validates `resource.data.ownerUid == request.auth.uid` (or `isBootstrappedAdmin()`) directly without calling `get()` or `exists()`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)

1. **Unauthenticated Read/Write**: Request with `auth == null` targeting `/cbt_snapshots/snap_1`.
2. **Unverified Admin Email Spoof**: Authenticated user with `email: 'tamtowiyahya65@gmail.com'` and `email_verified: false` attempting to read/write `/admins/spoofed`.
3. **Cross-Tenant PII Read**: Authenticated user B attempting `get` on user A's `/cbt_snapshots/snap_A/students/stu_1`.
4. **Owner Spoofing on Create**: User B creating `/cbt_snapshots/snap_B` with `ownerUid: "user_A"`.
5. **Shadow Field Injection**: Owner creating `/cbt_snapshots/snap_A` with extra ghost field `isSuperAdmin: true`.
6. **ID Poisoning Attack**: Owner creating `/cbt_snapshots/invalid$id..1500chars` failing `isValidId()`.
7. **Denial-of-Wallet Oversized String**: Owner writing `schoolName` > 160 chars or `announcementText` > 2000 chars.
8. **Unbounded Array Injection**: Owner writing `classes` array with 101 elements (> max 100) or non-string first element `[123]`.
9. **Orphaned Subcollection Write**: Owner writing `/cbt_snapshots/nonexistent_snap/students/stu_1` where parent snapshot does not exist.
10. **Immutable Field Tampering**: Owner updating `/cbt_snapshots/snap_A` attempting to alter `createdAt` or `ownerUid`.
11. **Client Timestamp Spoofing**: Owner creating a student record with client-supplied `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
12. **Terminal State Bypass**: Non-admin attempting to update `/cbt_snapshots/snap_A/attempts/att_1` after `existing().status == 'completed'` to alter `score`.
