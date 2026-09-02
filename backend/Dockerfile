FROM node:22-bookworm-slim AS build
ENV HUSKY=0
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY backend backend
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run prisma:generate -w backend && npm run build -w backend

FROM build AS migration
WORKDIR /app/backend
CMD ["/app/backend/node_modules/.bin/prisma", "migrate", "deploy"]

FROM build AS runtime-deps
WORKDIR /app
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app/backend
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=runtime-deps /app/node_modules /app/node_modules
COPY --from=runtime-deps /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/package.json ./package.json
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/backend/scripts ./scripts
USER node
EXPOSE 4000
CMD ["node", "dist/src/server.js"]
