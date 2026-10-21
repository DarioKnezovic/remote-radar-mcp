# The web app, for `docker compose up`. The MCP server for Claude runs on your machine
# (see README); both use the same Postgres and the same profile.json.

FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_STANDALONE=1
COPY package.json package-lock.json ./
COPY web/package.json web/
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src src
COPY migrations migrations
COPY boards.default.json profile.example.json ./
COPY web web
RUN npm run build && npm run build -w web

# The core's own production dependencies (pg, zod, …), pinned by the lockfile.
FROM node:24-alpine AS core-deps
WORKDIR /core
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --workspaces=false --ignore-scripts

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
# Next.js standalone output: the server and only the files it uses (web/server.js).
COPY --from=build /app/web/.next/standalone ./
COPY --from=build /app/web/.next/static web/.next/static
# The core, which the web app loads at runtime instead of bundling (see web/lib/radar.ts).
# It finds its migrations and boards.default.json next to its own files.
COPY --from=build /app/package.json /app/boards.default.json /app/profile.example.json \
  node_modules/remote-radar-mcp/
COPY --from=build /app/dist node_modules/remote-radar-mcp/dist
COPY --from=build /app/migrations node_modules/remote-radar-mcp/migrations
COPY --from=core-deps /core/node_modules node_modules/remote-radar-mcp/node_modules
WORKDIR /app/web
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=6 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/how-it-works || exit 1
# All interfaces inside the container (HOSTNAME above); docker-compose.yml publishes it on
# 127.0.0.1 only.
CMD ["node", "server.js"]
