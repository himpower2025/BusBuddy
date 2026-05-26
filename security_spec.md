# Security Specification for BusBuddy PRO

## 1. Data Invariants

1. **School Profile (`/schools/{schoolId}`)**:
   - `name`, `logo`, `routes`, and `driverName` are static fields and must be string formats with correct bounds.
   - GPS telemetry (`latitude`, `longitude`) are numbers within valid Earth coordinates (-90 to 90 for lat, -180 to 180 for lng).

2. **Real-time Chat Messages (`/schools/{schoolId}/messages/{messageId}`)**:
   - Every message belongs to a parent school.
   - Required fields are `sender`, `text`, `time`, `isBroadcast`, and `createdAt`.
   - `sender` must be non-empty and `text` must be constrained to 500 characters to prevent packet flooding attacks.
   - `createdAt` must match server time (`request.time`).

3. **Student Profile (`/schools/{schoolId}/students/{studentId}`)**:
   - Status must be one of the enum values: `["Wait", "Boarded", "Arrived"]`.

---

## 2. The "Dirty Dozen" Payloads

1. **Spoofed Sender Message**: Writing a message with someone else's UID or identity.
2. **Infinite Text Flooding**: Chat message text details exceeding 500 characters.
3. **Invalid Latitude/Longitude**: Driving coordinates set to absurd boundaries (e.g. latitude: 1000).
4. **Illegal Status Step**: Promoting student boarding stage to an unsupported state like "Deleted".
5. **Unauthorized School Editing**: Non-matching driver attempting to rewrite school-wide routes.
6. **Time Spoofing (Future/Past timestamps)**: Forcing client-side clocks to falsify message order.
7. **Bypassing Verification Rules**: Submitting writes without authenticated security tokens.
8. **Shadow Field Injection**: Adding custom fields like `isAdmin: true` dynamically to parent documents.
9. **Recursive Cost Multiplication**: Attacking read/write pipelines with nested subcollections.
10. **Target ID Poisoning**: Specifying 1.5KB string containing junk characters as school document IDs.
11. **Student Name Overwrite**: Erasing or changing a registered student's profile without ownership credentials.
12. **Blind Query Snatching**: Listing private/external school data files without identifying connection code.

---

## 3. Test Runner Definition

For security validation, tests ensures all payload attempts belonging to the "Dirty Dozen" are correctly intercepted and returned `PERMISSION_DENIED` blocks.
