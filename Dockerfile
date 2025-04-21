# Use Node.js 18 as the base image
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package.json files for both server and extension
COPY server/package.json server/package-lock.json* ./server/
COPY extension/package.json extension/package-lock.json* ./extension/

# Install dependencies for server
WORKDIR /app/server
RUN npm ci

# Install dependencies for extension
WORKDIR /app/extension
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY --from=deps /app/extension/node_modules ./extension/node_modules
COPY . .

# Build server
WORKDIR /app/server
RUN npm run build

# Build extension
WORKDIR /app/extension
RUN npm run build

# Production image, copy all the files and run the server
FROM base AS runner
WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/server/package.json ./server/
COPY --from=builder /app/extension/dist ./extension/dist

# Copy prisma schema and migration files
COPY --from=builder /app/server/prisma ./server/prisma

# Set environment variables
ENV NODE_ENV production
ENV PORT 3000

# Expose the port
EXPOSE 3000

# Run the server
CMD ["node", "server/dist/index.js"]
