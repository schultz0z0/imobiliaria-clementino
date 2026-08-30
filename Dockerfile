FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG VITE_GA_MEASUREMENT_ID=""
ENV VITE_GA_MEASUREMENT_ID=${VITE_GA_MEASUREMENT_ID}
RUN npm run build

FROM node:22-bookworm-slim AS api-builder
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends libheif-examples libtiff6 \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY shared ./shared
COPY server ./server
COPY scripts ./scripts
RUN npm run server:build
RUN npm run publisher:build
RUN node server/media/codecSmoke.mjs

FROM node:22-bookworm-slim AS api
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends libheif-examples libtiff6 \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=api-builder /app/dist-server ./dist-server
RUN mkdir -p /data/media/private /data/media/public \
  && chown -R node:node /data/media \
  && chmod 700 /data/media/private \
  && chmod 755 /data/media/public
ENV NODE_ENV=production
ENV MEDIA_ROOT=/data/media
USER node
EXPOSE 3000
CMD ["node", "dist-server/api/index.js"]

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
