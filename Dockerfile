# syntax=docker/dockerfile:1

# --- Stage 1: build client -------------------------------------------------
FROM node:22-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# --- Stage 2: build server ---------------------------------------------------
FROM node:22-alpine AS server-build
RUN apk add --no-cache python3 make g++
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# --- Stage 3: production runtime -------------------------------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app/server

COPY server/package*.json ./
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
    && npm ci --omit=dev \
    && apk del .build-deps

COPY --from=server-build /app/server/dist ./dist
COPY --from=client-build /app/client/dist ../client/dist

ENV DATA_DIR=/app/data
ENV PORT=4000
VOLUME ["/app/data"]
EXPOSE 4000

CMD ["node", "dist/index.js"]
