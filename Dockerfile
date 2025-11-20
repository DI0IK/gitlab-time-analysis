# Multi-stage Dockerfile for building and running the Next.js app

# Build stage
FROM node:21-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY pnpm-lock.yaml* yarn.lock* package-lock.json* ./
RUN apk add --no-cache python3 make g++ || true
RUN npm ci --prefer-offline --no-audit --progress=false
COPY . .
RUN npm run build

# Production stage
FROM node:21-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
EXPOSE 3000
CMD ["npm", "start"]
