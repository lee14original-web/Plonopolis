---
name: Server-stamped crop bonuses
description: Security rules for time-limited growth bonuses stored with plot crops.
---

Time-limited crop bonuses must be stamped per planting from the server clock. The server must overwrite a new planting timestamp, preserve both timestamp and entitlement on later updates, and reject client-forged entitlement values.

**Why:** Plot state is client-writable JSON. A marker is not server-authoritative if the client can forge the planting timestamp or remove a tutorial designation before planting. Old harvest RPC overloads can also bypass a new validation path if clients retain EXECUTE permission.

**How to apply:** Keep tutorial or other exemption assignments in a server-only table until consumed. Route harvests through a guarded RPC that reads persisted plot state and server time, revoke client access to legacy harvest overloads, and keep reward logic behind the guarded entry point.