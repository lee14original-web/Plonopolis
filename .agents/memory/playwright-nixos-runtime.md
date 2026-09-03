---
name: Playwright on NixOS
description: Runtime requirements for launching Playwright Chromium in this Replit workspace.
---

Playwright needs both its own downloaded Chromium binary and the browser runtime libraries declared for the Replit Nix environment.

**Why:** Installing the JavaScript package alone left no browser executable; after downloading Chromium, launches still failed on missing shared libraries such as GLib, NSPR, and GBM.

**How to apply:** In a fresh environment, install the Playwright Chromium runtime before running E2E tests. Keep the required Nix browser libraries available whenever Playwright or Chromium is upgraded.