# CPMS production image: one container serves the API and the built React app on $PORT.
# Used by CI (docker build check), docker-compose.yml (local run) and Cloud Run.
# Adapted from the Lab 5 starter kit; changes are listed in docs/labs/lab-05/deployment.md.
# No secret is baked into the image: DATABASE_URL, JWT_SECRET and SEED_DEMO_PASSWORD
# are injected at run time (local .env via compose, Secret Manager on GCP).

# ---- Stage 1: build the React client (Vite) ---------------------------------
FROM node:24-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
# VITE_API_URL is left unset: the client calls /api on the same origin.
RUN npm run build

# ---- Stage 2: runtime (Express API run with tsx + Prisma) -------------------
FROM node:24-alpine AS runtime
# Prisma's query engine needs OpenSSL on Alpine.
RUN apk add --no-cache openssl
WORKDIR /app/server

# Full install on purpose: tsx runs the TypeScript server and seed, and the Prisma CLI
# runs `prisma migrate deploy` in the migration job, both from this same image.
COPY server/package*.json ./
RUN npm ci && npm cache clean --force

COPY server/prisma ./prisma
RUN npx prisma generate

COPY server/tsconfig.json ./
COPY server/src ./src
COPY --from=client-build /app/client/dist /app/client/dist

ENV NODE_ENV=production \
    TZ=Asia/Bangkok \
    PORT=3000 \
    CLIENT_DIST_DIR=/app/client/dist
EXPOSE 3000

# Do not run as root.
USER node

# node is PID 1, so it receives SIGTERM from Cloud Run / docker stop directly.
CMD ["node", "--import", "tsx", "src/index.ts"]
