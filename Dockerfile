# ─────────────────────────────────────────────────────────────────────────────
# NEXUS Platform Dashboard (Angular) — Multi-stage Dockerfile
# Stage 1: builder  — ng build --configuration=production
# Stage 2: runtime  — nginx:alpine serving static files
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Angular build ────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy lockfiles first for cache
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy all source
COPY . .

# Production build (outputPath = dist/app as per angular.json)
RUN npm run build -- --configuration=production

# ── Stage 2: Nginx runtime ────────────────────────────────────────────────────
FROM nginx:1.25-alpine AS runtime

# Remove default content
RUN rm -rf /usr/share/nginx/html/*

# Copy Angular output — Angular 17+ SSR produce dist/app/browser/ para los archivos estáticos
COPY --from=builder /app/dist/app/browser /usr/share/nginx/html

# Angular SSR names the entry point index.csr.html — rename it so Nginx SPA routing works
RUN mv /usr/share/nginx/html/index.csr.html /usr/share/nginx/html/index.html 2>/dev/null || true

# Nginx config: SPA routing (all routes → index.html) + gzip + security headers
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Non-root — nginx can run on port 8080
RUN sed -i 's/listen       80;/listen       8080;/' /etc/nginx/conf.d/default.conf \
 && chown -R nginx:nginx /usr/share/nginx/html \
 && chown -R nginx:nginx /var/cache/nginx \
 && chown -R nginx:nginx /var/log/nginx \
 && touch /var/run/nginx.pid \
 && chown nginx:nginx /var/run/nginx.pid

USER nginx

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]

# ── Usage ─────────────────────────────────────────────────────────────────────
# docker build -t nexus/dashboard:latest nexus-platform-dashboard/
# docker run -p 8080:8080 nexus/dashboard:latest
