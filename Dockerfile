# ==========================================
# STAGE 1: BUILDER
# ==========================================
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install native dependencies required for isolated-vm, keyring, etc.
RUN apt-get update && apt-get install -y \
    python3 \
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
RUN apt-get update && apt-get install -y \
    libsecret-1-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy package metadata
COPY package*.json ./
COPY packages/core/package*.json ./packages/core/
COPY packages/dashboard/package*.json ./packages/dashboard/
COPY packages/mcp-server/package*.json ./packages/mcp-server/
COPY packages/policy/package*.json ./packages/policy/
COPY packages/signer/package*.json ./packages/signer/

# Install ONLY production dependencies (--omit=dev)
ENV NODE_ENV=production
RUN npm install --omit=dev --legacy-peer-deps

# Copy source code
COPY . .

# Inject the compiled frontend dashboard from the Builder stage
COPY --from=builder /app/packages/dashboard/dist ./packages/dashboard/dist

# Expose the ports used by Core/Dashboard and Policy Engine
EXPOSE 3000
EXPOSE 3001

# PERSISTENT STORAGE: Protect Nyxora's memory and configuration
VOLUME ["/root/.nyxora"]

# Start the daemon in the foreground
CMD ["npx", "ts-node", "-T", "launcher.ts"]
