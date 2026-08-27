# syntax=docker/dockerfile:1.7
#
# The Next.js container.
#
# Four stages, and the split is the point: `deps` changes only when the
# lockfile does, so a source-only edit reuses its layer and never reinstalls.
# `runtime` starts from a clean image and copies in the standalone bundle, so
# nothing that was needed to *build* the app — the toolchain, the dev
# dependencies, the source — is present in what actually ships.

ARG NODE_VERSION=24-alpine

# ------------------------------------------------------------------ deps
FROM node:${NODE_VERSION} AS deps
# Next's optional native pieces are glibc-linked; this is the shim Alpine needs.
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV PNPM_HOME=/pnpm
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

COPY package.json pnpm-lock.yaml ./
# The store is a cache mount rather than a layer: it survives between builds
# without being shipped in one.
#
# `node-linker hoisted` lays node_modules out flat, the way npm would.
# `output: "standalone"` traces the modules the server reaches and copies them
# into a self-contained tree, and that tracer follows real paths — pnpm's nested
# symlink layout hides transitive dependencies from it, so `@swc/helpers` goes
# missing and the container crash-loops on MODULE_NOT_FOUND. It never shows up
# in development, where the standalone folder sits inside the project and Node
# walks up to the full node_modules; in the image there is no parent to fall
# back on.
RUN --mount=type=cache,target=/pnpm/store \
	pnpm config set store-dir /pnpm/store && \
	pnpm config set node-linker hoisted && \
	pnpm install --frozen-lockfile

# ----------------------------------------------------------------- build
FROM node:${NODE_VERSION} AS build
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV PNPM_HOME=/pnpm
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Anything NEXT_PUBLIC_ is *inlined into the JavaScript at build time*, not read
# at run time — so this has to be a build argument, and an image built with the
# wrong one cannot be fixed by changing the environment later.
#
# It has to name the same host the app is served from, or a subdomain of it. The
# game server authenticates with the Auth.js session cookie, and that cookie
# only travels to the domain it was issued for: point this at another host and
# every player joins as a guest.
ARG NEXT_PUBLIC_GAME_SERVER_URL
ENV NEXT_PUBLIC_GAME_SERVER_URL=${NEXT_PUBLIC_GAME_SERVER_URL}

# The build needs no secrets: every server-side value is read at run time, and
# validating a schema full of credentials here would only mean shipping them.
ENV SKIP_ENV_VALIDATION=1

# One exception, and it is not a secret. `next build` evaluates every route to
# collect page data, and the Auth.js Drizzle adapter inspects the database
# client while it does. Without a URL that client is deliberately a Proxy that
# throws on touch (see `server/db/index.ts`), so the build dies on routes that
# will never run in this stage. A placeholder is enough to get a real client
# object: `createPool` opens no connection until something queries, and nothing
# here does. Compose supplies the real URL at run time.
ARG DATABASE_URL=mysql://build:build@127.0.0.1:3306/build
ENV DATABASE_URL=${DATABASE_URL}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN pnpm build:next

# --------------------------------------------------------------- runtime
FROM node:${NODE_VERSION} AS runtime
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# The standalone server binds to localhost unless told otherwise, which inside a
# container means nothing outside it can connect.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# `output: "standalone"` traces the modules the server actually reaches and
# writes a self-contained tree — no package manager, no node_modules to install,
# and none of the build toolchain.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

# The node image ships this user for exactly this reason.
USER node

EXPOSE 3000

# Cheap enough to run every 30s: it answers from memory and touches nothing.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
