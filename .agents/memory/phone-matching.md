---
name: Conservative phone matching
description: Safety rule for matching local and international contact phone numbers.
---

Canonicalize a local phone number to E.164 only when trusted region metadata is available. Preserve exact digit matching for legacy international numbers without a plus sign, but never infer equivalence from a shared suffix.

**Why:** Local numbers with identical digits can belong to different people in different countries. Suffix matching or guessing a default region can silently merge unrelated contacts.

**How to apply:** Use an explicit international prefix when present. Otherwise require validated device/address-book region metadata before region-aware parsing; leave ambiguous local numbers unmatched.