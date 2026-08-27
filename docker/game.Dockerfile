# syntax=docker/dockerfile:1.7
#
# The Colyseus container.
#
# `build:game` bundles the server with esbuild but leaves node_modules external,
# so unlike the Next image this one still needs its dependencies at run time.
# It gets a production-only install: the same lockfile, without the toolchain.

ARG NODE_VERSION=24-alpine

# ------------------------------------------------------------------ deps
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
ENV PNPM_HOME=/pnpm
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/pnpm/store \
	pnpm config set store-dir /pnpm/store && \
	pnpm install --frozen-lockfile

# ----------------------------------------------------------------- build
FROM node:${NODE_VERSION} AS build
WORKDIR /app
ENV PNPM_HOME=/pnpm
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `build:game` typechecks before it bundles, so a room that does not compile
# fails the image build rather than the first join.
RUN pnpm build:game

# ------------------------------------------------------------ prod deps
# A second install, from the same lockfile, with the dev dependencies left out.
FROM node:${NODE_VERSION} AS prod-deps
WORKDIR /app
ENV PNPM_HOME=/pnpm
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/pnpm/store \
	pnpm config set store-dir /pnpm/store && \
	pnpm install --frozen-lockfile --prod

# --------------------------------------------------------------- runtime
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV GAME_PORT=2567

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.game-build ./.game-build
# The bundle resolves its dependencies from here, and Node needs the manifest to
# know the tree is ESM.
COPY --chown=node:node package.json ./

USER node

EXPOSE 2567

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD wget --quiet --tries=1 --spider http://127.0.0.1:2567/health || exit 1

CMD ["node", ".game-build/server.mjs"]
