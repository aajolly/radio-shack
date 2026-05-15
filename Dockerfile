# ── Stage 1: install all deps (including devDeps needed by the build tools) ─────
FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci


# ── Stage 2: compile Tailwind CSS ───────────────────────────────────────────────
FROM deps AS builder
COPY . .
RUN npm run css:build


# ── Stage 3: development image ──────────────────────────────────────────────────
# Source code and db/ are bind-mounted at runtime by docker-compose (dev profile).
# node_modules comes from the deps stage so the mount doesn't shadow it.
FROM deps AS dev
EXPOSE 3000
CMD ["npm", "run", "dev"]


# ── Stage 4: production image (lean) ────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Only production deps (express, morgan) — tailwindcss/nodemon/etc. are excluded
COPY package*.json ./
RUN npm ci --omit=dev

# Application code
COPY server.js ./
COPY db/init.js ./db/

# Built frontend: HTML, JS, logo, and compiled style.css from the builder stage
COPY --from=builder /app/public ./public

EXPOSE 3000

# Run node directly — npm start would try to css:build which needs devDeps
CMD ["node", "server.js"]
