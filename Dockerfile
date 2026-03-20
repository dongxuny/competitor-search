ARG BUILD_NODE_IMAGE=node:20
ARG PLAYWRIGHT_RUNTIME_IMAGE=mcr.microsoft.com/playwright:v1.50.0-noble

FROM --platform=$BUILDPLATFORM ${BUILD_NODE_IMAGE} AS build
ARG BUILDPLATFORM
ARG TARGETPLATFORM
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM --platform=$TARGETPLATFORM ${PLAYWRIGHT_RUNTIME_IMAGE} AS runtime
ARG TARGETPLATFORM
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8787

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY --from=build /app/dist ./dist

EXPOSE 8787

CMD ["node", "server/index.js"]
