FROM node:26.8-bookworm-slim@sha256:cd9f682fa2885cd1056e830424764158570061c59736a1da836bc3d73df095ae AS build
WORKDIR /app
COPY . .
RUN npm ci --ignore-scripts
RUN npm run build

FROM node:26.8-bookworm-slim@sha256:cd9f682fa2885cd1056e830424764158570061c59736a1da836bc3d73df095ae AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages/core/migrations ./packages/core/migrations
COPY --from=build --chown=node:node /app/packages/features/identity/migrations ./packages/features/identity/migrations
COPY --from=build --chown=node:node /app/packages/features/rooms/migrations ./packages/features/rooms/migrations
COPY --from=build --chown=node:node /app/packages/features/friends/migrations ./packages/features/friends/migrations
COPY --from=build --chown=node:node /app/packages/features/pomodoro/migrations ./packages/features/pomodoro/migrations
COPY --from=build --chown=node:node /app/packages/features/tasks/migrations ./packages/features/tasks/migrations
COPY --from=build --chown=node:node /app/packages/features/chat/migrations ./packages/features/chat/migrations
COPY --from=build --chown=node:node /app/packages/features/backgrounds/migrations ./packages/features/backgrounds/migrations
COPY --from=build --chown=node:node /app/packages/features/room-media/migrations ./packages/features/room-media/migrations
USER node
EXPOSE 3001
CMD ["node", "dist/api/main.mjs"]

FROM node:26.8-bookworm-slim@sha256:cd9f682fa2885cd1056e830424764158570061c59736a1da836bc3d73df095ae AS web
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
