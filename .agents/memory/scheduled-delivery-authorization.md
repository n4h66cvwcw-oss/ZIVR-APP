---
name: Scheduled delivery authorization
description: Security rule for messages and other actions that execute later.
---

Queued messages must recheck the sender's current chat membership, group limits, and parental contact approvals immediately before delivery.

**Why:** Permission can change between scheduling and delivery. Treating the original scheduling check as permanent could let a message bypass a later removal, block, or approval revocation.

**How to apply:** Validate once when accepting a queued action for fast feedback, then validate again in the server dispatcher. Fail closed without delivering when current authorization no longer permits the action.

Optional final-approval reminders are advisory: they offer “send as planned” and “cancel” shortly before delivery, but an ignored reminder must not hold or cancel the message.