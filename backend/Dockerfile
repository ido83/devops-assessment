FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY server.js ./
RUN mkdir -p /app/data
EXPOSE 4000
CMD ["node", "server.js"]
