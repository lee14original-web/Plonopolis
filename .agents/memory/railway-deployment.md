---
name: Railway deployment config for Plonopolis
description: How Plonopolis is deployed to Railway from GitHub — pitfalls and working config.
---

# Railway Deployment — Plonopolis

## Working setup (as of 2026-07-27)

- **Builder**: Dockerfile (not Nixpacks — Nixpacks failed with Module._load native binary crash)
- **Static server**: nginx:alpine (not `serve` — `serve` caused status:0/CSP issues blocking Supabase fetch)
- **GitHub repo**: https://github.com/lee14original-web/Plonopolis
- **Railway URL**: plonopolis-production.up.railway.app

## Key pitfalls

### 1. Force-push triggered rebuild with stale Nixpacks cache
The original GitHub repo was a Next.js app. After force-push of the pnpm monorepo, Railway's cached node_modules (from Next.js) caused native binary failures (`Module._load` crash during Vite config loading).

**Fix**: Switched to Dockerfile builder.

### 2. VITE_* vars must be Docker build ARGs
Vite bakes `import.meta.env.VITE_*` at build time. For Dockerfile builds on Railway, env vars are NOT automatically passed unless declared with `ARG` in the Dockerfile.

**Fix**: Add to Dockerfile (before the build step):
```dockerfile
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
```
Railway Variables required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

### 3. `serve` package caused status:0 Supabase fetch failure
Using `npx serve -s public` as the static server caused browser fetch to Supabase to fail with `status: 0` ("Failed to fetch"). Likely a CSP or header issue with the `serve` package.

**Fix**: Use nginx:alpine as the production stage.

### 4. pnpm lockfile mismatch on Railway
`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` — Railway used older pnpm that didn't understand `overrides` in `pnpm-workspace.yaml` (pnpm v10 feature).

**Fix**: Add `"packageManager": "pnpm@10.26.1"` to root `package.json`.
Also use `--no-frozen-lockfile` in the Dockerfile install step.

### 5. `pnpm-workspace.yaml` overrides exclude Replit-only platform binaries
The workspace excludes many platform-specific optional deps (darwin, musl, etc.) to keep Replit's linux-x64-gnu lean. This is fine for Railway too (also linux-x64-gnu).

## Railway Variables needed
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key
- (Old `NEXT_PUBLIC_*` vars are harmless but unused)

## nginx config
PORT is dynamic (Railway sets it). Use `envsubst` to substitute `$PORT` at container startup:
```sh
envsubst '$PORT' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'
```

**Why:** `gettext` package provides `envsubst`. Install with `apk add --no-cache gettext`.
