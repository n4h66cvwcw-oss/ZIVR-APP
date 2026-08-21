---
name: Time-limited access windows
description: Rules for enforcing temporary parental access overrides without client-clock bypasses.
---

Temporary access windows must remain server-authoritative: return a server-calculated remaining duration to schedule a fresh access check, rather than comparing a server timestamp against the device clock.

**Why:** A manipulated or skewed device clock can otherwise delay a relock indefinitely. Realtime events are also transient, so a locked child must recheck server state after an authenticated socket reconnect.

**How to apply:** For any temporary unlock, persist the expiry on the server, have the child revalidate on an override event and reconnect, and perform a strict server recheck when the returned remaining duration ends.