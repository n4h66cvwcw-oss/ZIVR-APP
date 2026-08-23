---
name: Verified store destinations
description: Rules for activating public ZIVR store-download links.
---

Public download calls to action must remain inactive until they point to an official HTTPS App Store listing or Google Play detail page. An unavailable platform must visibly communicate that it is coming soon, rather than looking like a working download destination.

**Why:** A generic URL check can turn an “official listing” claim into a link to an arbitrary or malformed destination. Clear per-platform availability also prevents families from interpreting a disabled store badge as a broken download button.

**How to apply:** When changing store-link configuration or the marketing download section, validate platform-specific official hosts and listing paths before rendering an anchor. Keep absent, malformed, or unsupported URLs inert, and accurately describe single-store versus dual-store availability.