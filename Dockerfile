FROM node:22-slim AS builder
WORKDIR /app

# Install pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

# Copy workspace config first (for layer caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy all package.json files for workspace packages
COPY artifacts/plonopolis/package.json ./artifacts/plonopolis/
COPY lib/ ./lib/

# Install dependencies (no frozen lockfile — lockfile was made on NixOS)
RUN pnpm install --no-frozen-lockfile

# Copy remaining source files
COPY . .

# Vite bakes VITE_* vars at build time — declare as ARGs so Railway passes them in
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Build
RUN pnpm --filter @workspace/plonopolis run build

# ─── Production image ───────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/artifacts/plonopolis/dist/public ./public

EXPOSE 3000
CMD serve -s public -l tcp://0.0.0.0:${PORT:-3000}
