# The web app, for `docker compose up`. The MCP server for Claude runs on your machine
# (see README); both use the same Postgres and the same profile.json.

FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY web/package.json web/
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src src
COPY migrations migrations
COPY boards.default.json profile.example.json ./
COPY web web
RUN npm run build && npm run build -w web && npm prune --omit=dev

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/dist dist
COPY --from=build /app/migrations migrations
COPY --from=build /app/boards.default.json /app/profile.example.json ./
COPY --from=build /app/web/package.json /app/web/next.config.ts web/
COPY --from=build /app/web/.next web/.next
WORKDIR /app/web
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=6 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/how-it-works || exit 1
# All interfaces inside the container; docker-compose.yml publishes it on 127.0.0.1 only.
CMD ["../node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
