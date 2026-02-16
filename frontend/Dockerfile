# ── Stage 1: Build React app ──
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps
COPY public/ ./public/
COPY src/ ./src/
ENV REACT_APP_API_URL=/api
RUN npm run build

# ── Stage 2: Serve with nginx ──
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
