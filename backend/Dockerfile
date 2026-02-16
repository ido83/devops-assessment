# ── Stage 1: Install dependencies ──
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production && npm cache clean --force

# ── Stage 2: Production image ──
FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S secassess -u 1001
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
COPY server.js ./
USER secassess
EXPOSE 4000
CMD ["node", "server.js"]
