FROM node:22-slim AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY artifacts/plonopolis/package.json ./artifacts/plonopolis/
COPY lib/ ./lib/

RUN pnpm install --no-frozen-lockfile

COPY . .

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN pnpm --filter @workspace/plonopolis run build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

COPY --from=builder /app/artifacts/plonopolis/dist/public ./public
COPY server.js .

EXPOSE 3000
CMD ["node", "server.js"]
