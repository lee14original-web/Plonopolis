---
name: SQL RPC replacement order
description: Prevent older standalone SQL patches from silently removing authorization checks added by newer migrations.
---

When several shipped SQL files use `CREATE OR REPLACE FUNCTION` for the same RPC, every definition that may still be executed must preserve current authorization gates, or explicitly refuse to run after the newer schema exists.

**Why:** Applying an older patch after a security migration can silently restore the old function body and bypass onboarding or entitlement checks even though the main migration is correct.

**How to apply:** Before changing a security-sensitive RPC, search all SQL assets for duplicate definitions. Update each compatible definition or add a schema-aware guard that prevents stale code from replacing the canonical function.