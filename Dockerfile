FROM node:22-slim AS builder
WORKDIR /app

# Install pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

# Copy workspace config first (for layer caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy all package.json files for workspace packages
COPY artifacts/plonopolis/package.json ./artifacts/plonopolis/
COPY lib/ ./lib/

# Install dependencies
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

# ─── Production image (nginx) ────────────────────────────────────────────────
FROM nginx:alpine AS runner

# envsubst replaces $PORT in nginx.conf at runtime
RUN apk add --no-cache gettext

COPY --from=builder /app/artifacts/plonopolis/dist/public /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf.template

# Railway sets $PORT dynamically; default 8080
EXPOSE 8080
CMD ["/bin/sh", "-c", "export PORT=${PORT:-8080} && envsubst '$PORT' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
