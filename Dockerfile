# Railway Containerization Dockerfile for React + Node.js Express + PostgreSQL
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package manifests & install
COPY package*.json ./
RUN npm ci

# Copy application source
COPY . .

# Build Vite frontend production assets
RUN npm run build

# Production Runner Stage
FROM node:18-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production

# Copy server & dist assets from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

EXPOSE 3000

CMD ["npm", "start"]
