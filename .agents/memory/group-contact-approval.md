---
name: Group contact approval
description: Safety rule for group membership and delivery when child accounts are involved.
---

Rule: A group is usable only when every child member has approval for every other non-parent member. Enforce this on creation and again on message delivery so pre-existing groups and later approval changes cannot bypass parental controls. Keep group approval checks batched and retain a bounded group size.

**Why:** Direct-message approval alone leaves a group-chat bypass. Per-pair database checks also turn large groups into an avoidable availability risk.

**How to apply:** Any future group creation, membership update, or group message path must perform the same all-child-pairs approval decision before exposing or delivering the group interaction.