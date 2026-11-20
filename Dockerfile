# Deepslate Dungeons (Next.js 16) — classic multi-stage build.
#
# Build-time: NEXT_PUBLIC_* vars are inlined into the client bundle, so the
# build stage reads .env / .env.local from the build context (they stay OUT of
# the final image). Runtime: server-side secrets (DATABASE_URL, CLERK_SECRET_KEY,
# MONGODB_URI, UPSTASH_*, SUPABASE_SERVICE_ROLE_KEY, AI_SERVER_URL…) are
# injected by docker-compose env_file — never baked in.
#
#   docker build -t deepslate-web .
#   docker run --env-file .env -p 3000:3000 deepslate-web
# (or use docker-compose.yml in the AI repo root, which wires up the AI server)
#
# Requires a Next.js-compatible server env: AI_SERVER_URL must point at the
# AI server (compose sets http://ai-server:8000).

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# dev deps are needed for `next build` (react compiler, typescript, tailwind)
RUN npm ci --include=dev

FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./next.config.ts
EXPOSE 3000
CMD ["npm", "start"]
