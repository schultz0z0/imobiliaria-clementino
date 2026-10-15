FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG VITE_GA_MEASUREMENT_ID=""
ENV VITE_GA_MEASUREMENT_ID=${VITE_GA_MEASUREMENT_ID}
ARG VITE_GOOGLE_ADS_ID=""
ENV VITE_GOOGLE_ADS_ID=${VITE_GOOGLE_ADS_ID}
ARG VITE_META_PIXEL_ID="1324132266370583"
ENV VITE_META_PIXEL_ID=${VITE_META_PIXEL_ID}
ARG VITE_GOOGLE_SITE_VERIFICATION=""
ENV VITE_GOOGLE_SITE_VERIFICATION=${VITE_GOOGLE_SITE_VERIFICATION}
RUN npm run build \
  && find /app/dist -type d -exec chmod 755 {} + \
  && find /app/dist -type f -exec chmod 644 {} +

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
COPY src ./src
RUN npm run server:build
RUN npm run publisher:build
RUN npm run seo:server:build
RUN npx esbuild server/db/migrate.ts --bundle --packages=external --platform=node --target=node22 --format=esm --outfile=dist-server/db/migrate.js
RUN node server/media/codecSmoke.mjs

FROM node:22-bookworm-slim AS api
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends libheif-examples libtiff6 \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=api-builder /app/dist-server ./dist-server
COPY --from=api-builder /app/server/migrations ./dist-server/migrations
COPY --from=builder /app/dist ./site-dist
COPY --from=builder /app/src/data/properties.generated.json ./site-catalog.json
RUN mkdir -p /data/media/private /data/media/public \
  && chown -R node:node /data/media \
  && chmod 700 /data/media/private \
  && chmod 755 /data/media/public
ENV NODE_ENV=production
ENV MEDIA_ROOT=/data/media
USER node
EXPOSE 3000
CMD ["node", "dist-server/api/index.js"]

FROM nginx:1.27-alpine AS website
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
