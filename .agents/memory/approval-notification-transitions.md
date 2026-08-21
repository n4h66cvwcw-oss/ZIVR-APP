---
name: Approval notification transitions
description: How to prevent duplicate child contact-approval alerts under concurrent parent actions.
---

Contact-approval notifications must be emitted only by the request that atomically changes the approval status to `approved`, rather than by a separate read followed by a write.

**Why:** Multiple parent devices can review the same request concurrently. A stale read of `pending` on each device makes both reviewers appear entitled to send a notification.

**How to apply:** Use a conditional insert-or-update that returns a row only when it inserts or changes the status. Gate socket and push delivery on that returned transition, and keep the client from allowing stale list fetches to overwrite newer local or socket updates.