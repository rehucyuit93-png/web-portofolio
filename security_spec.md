# Security Specification & Hardened Audit Spec

## 1. Data Invariants
1. **Default-Deny Safety Net**: Every path not explicitly matched is denied (`allow read, write: if false`).
2. **Authentication & Verified Email**: All mutations and private reads require `request.auth != null && request.auth.token.email_verified == true`.
3. **Owner Isolation**: Private collections (`profiles`, `documents`, `certificates`, `achievements`, `activities`, `galleries`, `settings`, `logs`) strictly enforce `uid == request.auth.uid` on both single-document reads/writes and list queries (`resource.data.uid == request.auth.uid`), unless the caller passes `isAdmin()`.
4. **No Self-Assigned Admin Privilege**: A user creating their own `/users/{userId}` document may ONLY assign `role` in `['guru', 'siswa']`. Only an existing trusted admin (`isAdmin()`) can assign `role == 'admin'` or write to `/admins/{userId}`.
5. **PII Isolation**: `/users` and `/profiles` contain email, phone, home address, and birth date. Non-owners (except Admin) are completely blocked from reading them. Public sharing uses `/publicPortfolios/{username}` which excludes `email`, `phone`, `address`, and `birthDate`, and allows `get` only when `isPublished == true` (disallowing `list` scraping for non-admins).
6. **Temporal Integrity & Immutability**: `createdAt == request.time` on creation; `updatedAt == request.time` on updates; `uid` and `createdAt` are immutable after creation.
7. **Audit Log Immutability**: `/logs/{logId}` entries cannot be updated or deleted by standard users.

## 2. Dirty Dozen Attack Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Private Read**: Anonymous `get /profiles/userA` -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: Authenticated user with `email_verified: false` creating `/documents/doc1` -> `PERMISSION_DENIED`.
3. **Self-Admin Escalation**: User registering `/users/attacker` with `{ "role": "admin" }` -> `PERMISSION_DENIED`.
4. **Role Tampering on Update**: Non-admin user updating own `/users/userA` changing `role` from `"siswa"` to `"admin"` -> `PERMISSION_DENIED`.
5. **Cross-Tenant Document Spoofing**: `userA` creating `/documents/doc2` with `{ "uid": "userB" }` -> `PERMISSION_DENIED`.
6. **Cross-Tenant List Scraping**: `userA` querying `/documents` without `where("uid", "==", "userA")` -> `PERMISSION_DENIED`.
7. **Ghost Field Injection (Shadow Update)**: `userA` creating `/certificates/cert1` with extra unexpected key `"isVerified": true` -> `PERMISSION_DENIED`.
8. **ID Poisoning**: Creating `/documents/<1024-char-string>` or ID with `/` or `$` -> `PERMISSION_DENIED`.
9. **Oversized String Payload (Denial of Wallet)**: Updating `/profiles/userA` with a 50KB `bio` string (`> 1500` chars) -> `PERMISSION_DENIED`.
10. **Log Tampering**: `userA` attempting `update` or `delete` on `/logs/log1` -> `PERMISSION_DENIED`.
11. **Unpublished Public Portfolio Peek**: Unauthenticated visitor reading `/publicPortfolios/userA` when `isPublished == false` -> `PERMISSION_DENIED`.
12. **Public Portfolio Scraping**: Unauthenticated visitor running `list /publicPortfolios` -> `PERMISSION_DENIED`.
