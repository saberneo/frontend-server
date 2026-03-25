# ─────────────────────────────────────────────────────────────────────────────
# NEXUS Backend (NestJS) — Multi-stage Dockerfile
# Stage 1: deps      — installs node_modules
# Stage 2: builder   — compiles TypeScript → dist/
# Stage 3: runtime   — lean production image (node:20-alpine)
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: dependency installation ─────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy lockfiles only — maximises cache reuse
COPY package.json package-lock.json ./

RUN npm ci --omit=dev --ignore-scripts

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Need devDependencies (TypeScript compiler, etc.)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source and compile
COPY . .
RUN npm run build

# ── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Non-root user
RUN addgroup --system --gid 1001 nexus \
 && adduser  --system --uid 1001 --ingroup nexus nexus

WORKDIR /app

# Security hardening
RUN apk add --no-cache curl dumb-init

# Production node_modules from deps stage
COPY --from=deps    --chown=nexus:nexus /app/node_modules ./node_modules

# Compiled output from builder stage
COPY --from=builder --chown=nexus:nexus /app/dist         ./dist
COPY --from=builder --chown=nexus:nexus /app/package.json ./package.json

USER nexus

# Healthcheck — checks the /api/system-health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:3000/api/system-health || exit 1

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

# dumb-init handles PID 1 signal forwarding properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]

# ── Usage ─────────────────────────────────────────────────────────────────────
# docker build -t nexus/backend:latest nexus-backend/
# docker run -p 3000:3000 --env-file .env nexus/backend:latest
