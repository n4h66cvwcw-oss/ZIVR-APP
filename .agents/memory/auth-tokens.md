---
name: Server-derived identity is mandatory
description: Security decision — API/socket mutations must never trust client-asserted user IDs
---

Rule: every api-server mutation (HTTP or socket) must derive the acting user from a signed credential, never from a user id in the request payload; parent-only actions must additionally verify the parent↔child link.

**Why:** Client-asserted identity (or a "first-come token claim" bootstrap) is broken access control — anyone can impersonate any user, which defeats parental-control and privacy guarantees. Tokens may only be issued at registration or handed to an already-authenticated party (e.g. the parent receives the child's token when creating the child account).

**How to apply:** When adding endpoints or socket events, reuse the existing token verification helpers and compare the derived identity against any user-scoped resource before reading or writing it (membership checks for chats — including socket room joins — ownership checks for backups, vm_parent_child for parental actions).
