---
name: Expo Launch build numbers
description: App Store submission behavior when Expo Launch reuses an already-uploaded iOS build number
---

Expo Launch can submit an iOS binary with the same build number as a previous upload when the production profile relies on local auto-increment and the checked-in app configuration was not advanced. App Store Connect rejects this with a duplicate bundle-version error.

**Why:** Apple requires every uploaded iOS build for a bundle identifier to have a strictly higher `CFBundleVersion` than all previous uploads.

**How to apply:** Before retrying a failed Expo Launch submission, read the retained Launch logs and compare the produced build number with App Store Connect's previous build. Advance the static Expo configuration to the next unused iOS build number and avoid relying on a stale local auto-increment baseline.