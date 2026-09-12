---
name: Realtime check-in safety
description: Authorization, privacy, retry, and offline-cache rules for durable broadcast check-ins.
---

Check-in group creation and every broadcast or reply must re-check current family/contact approval. The server derives identity from authentication, persists before emitting, and exposes member replies and aggregate progress only to the broadcast creator.

**Why:** Check-ins are another messaging channel. Checking permission only when a group is created lets later blocks or revoked approvals be bypassed, while broad progress/reply events leak other members' participation.

**How to apply:** Reuse a durable client operation ID across timeout/reconnect until any canonical acknowledgement or hydration record reconciles it. Keep offline check-in caches and pending operations scoped to the active account, merge snapshots monotonically, and never erase a valid cache because a refresh failed.