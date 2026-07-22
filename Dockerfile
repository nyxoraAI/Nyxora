# ==========================================
# STAGE 1: BUILDER
# ==========================================
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install native dependencies required for isolated-vm, keyring, etc.
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    make \
    g++ \
    libsecret-1-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package metadata first to leverage Docker caching
COPY package*.json ./
COPY packages/core/package*.json ./packages/core/
COPY packages/dashboard/package*.json ./packages/dashboard/
COPY packages/mcp-server/package*.json ./packages/mcp-server/
COPY packages/policy/package*.json ./packages/policy/
COPY packages/signer/package*.json ./packages/signer/
COPY packages/desktop/package*.json ./packages/desktop/
COPY packages/tui/package*.json ./packages/tui/
COPY packages/nyxora-ink/package*.json ./packages/nyxora-ink/
COPY scripts/install-ml-engine.mjs ./scripts/install-ml-engine.mjs

# Install ALL dependencies (including devDependencies for Vite)
RUN npm install --legacy-peer-deps

# Copy the rest of the application code
COPY . .

# Build the dashboard (frontend)
RUN npm run build --workspace=nyxora-dashboard


# ==========================================
# STAGE 2: PRODUCTION
# ==========================================
FROM node:22-bookworm-slim

WORKDIR /app

# Install ONLY runtime OS dependencies (saves massive space)
# We also temporarily install build tools for native node modules (node-pty, keyring)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    make \
    g++ \
    libsecret-1-0 \
    libsecret-1-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package metadata
COPY package*.json ./
COPY packages/core/package*.json ./packages/core/
COPY packages/dashboard/package*.json ./packages/dashboard/
COPY packages/mcp-server/package*.json ./packages/mcp-server/
COPY packages/policy/package*.json ./packages/policy/
COPY packages/signer/package*.json ./packages/signer/
COPY packages/desktop/package*.json ./packages/desktop/
COPY packages/tui/package*.json ./packages/tui/
COPY packages/nyxora-ink/package*.json ./packages/nyxora-ink/
COPY scripts/install-ml-engine.mjs ./scripts/install-ml-engine.mjs

# Install ONLY production dependencies (--omit=dev)
ENV NODE_ENV=production
RUN npm install --omit=dev --legacy-peer-deps

# Remove build tools to keep image slim (but KEEP python3 for ML Engine)
RUN apt-get remove -y make g++ libsecret-1-dev \
    && apt-get autoremove -y \
    && apt-get clean

# Copy source code
COPY . .

# Inject the compiled frontend dashboard from the Builder stage
COPY --from=builder /app/packages/dashboard/dist ./packages/dashboard/dist

# Setup ML Engine globally in Docker
RUN python3 -m venv /app/ml-venv \
    && /app/ml-venv/bin/pip install -r packages/ml-engine/requirements.txt

ENV ML_ENGINE_PYTHON_PATH=/app/ml-venv/bin/python

# Expose the ports used by Core/Dashboard and Policy Engine
EXPOSE 3000
EXPOSE 3001

# PERSISTENT STORAGE: Protect Nyxora's memory and configuration
VOLUME ["/root/.nyxora"]

# Start the daemon in the foreground
CMD ["npx", "ts-node", "-T", "launcher.ts"]
