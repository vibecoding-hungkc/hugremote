FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install build tools for node-pty C++ compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    gcc \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package configs
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
RUN cd /app/server && npm install
RUN cd /app/client && npm install

# Copy source
COPY server/ ./server/
COPY client/ ./client/

# Build client into server/public
RUN cd /app/client && npm run build

# Build server TypeScript into server/dist
RUN cd /app/server && npm run build

# --- RUNNER STAGE ---
FROM node:22-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    git \
    curl \
    openssh-client \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=8099
ENV HOST=0.0.0.0
ENV WORKSPACE_ROOT=/workspace
ENV ALLOWED_ROOT=/

# Copy production artifacts
COPY --from=builder /app/server/package*.json ./
COPY --from=builder /app/server/node_modules ./node_modules
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/public ./public

EXPOSE 8099

CMD ["node", "dist/index.js"]
