FROM node:22-bookworm-slim

# Set working directory
WORKDIR /app

# Set Production Environment
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

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the dashboard (frontend)
RUN npm run build --workspace=dashboard

# Set Production Environment now that build is done
ENV NODE_ENV=production

# Expose the ports used by Core/Dashboard and Policy Engine
EXPOSE 3000
EXPOSE 3001

# PERSISTENT STORAGE: Protect Nyxora's memory and configuration
VOLUME ["/root/.nyxora"]

# Start the daemon in the foreground
CMD ["npx", "ts-node", "-T", "launcher.ts"]
