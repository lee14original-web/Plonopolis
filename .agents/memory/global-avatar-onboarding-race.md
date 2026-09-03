---
name: Global avatar onboarding race
description: Preventing first-avatar onboarding from being skipped during concurrent profile loading.
---

Whether initial avatar onboarding is required must be tracked from the global account response independently of the currently displayed avatar skin.

**Why:** Login and registration can load the server profile and global account concurrently. On slower mobile timing, a temporary legacy/default profile avatar can win the first state update and suppress onboarding even when the global account still has no selected avatar.

**How to apply:** Use the global account's nullable avatar as the authority for onboarding eligibility. Treat local storage and per-server profile avatars only as display/cache fallbacks, and clear the requirement only after the initial-avatar RPC succeeds.