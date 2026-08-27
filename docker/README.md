# Running in containers

Four services: the Next.js app, the Colyseus game server, the MySQL both of
them share, and the Caddy that faces the internet in front of all three. The game server reads Auth.js sessions straight out of that
database, which is why it is one database and not two.

```
docker compose --env-file .env.docker up -d --build
```

## First deploy

```bash
cp .env.docker.example .env.docker      # then fill it in — see the notes in it
docker compose --env-file .env.docker build
docker compose --env-file .env.docker up -d mysql
docker compose --env-file .env.docker --profile migrate run --rm migrate
docker compose --env-file .env.docker up -d
```

Migrations are a separate step on purpose. Applying schema changes automatically
on container start means a bad deploy rewrites the database before anyone can
stop it.

## The domain rule

This is the one that bites, and it fails silently rather than loudly.

The game server authenticates a player by reading the Auth.js session cookie off
their join request. A cookie is only sent to the domain it was issued for, plus
subdomains of an explicit `domain`. So all three of these have to agree:

| | |
|---|---|
| `AUTH_URL` | `https://esahist.ro` |
| `NEXT_PUBLIC_GAME_SERVER_URL` | `https://game.esahist.ro` |
| `AUTH_COOKIE_DOMAIN` | `.esahist.ro` |

Put the game server on a different domain — or forget `AUTH_COOKIE_DOMAIN` — and
nothing errors. Every player is seated as an anonymous guest with no name, no
rating, and a game that cannot be saved, because a guest has no user row for the
foreign key to point at. If `ALLOW_ANONYMOUS` is `false`, as it must be in
production, they instead get a join that fails outright.

`NEXT_PUBLIC_GAME_SERVER_URL` is compiled into the browser bundle, not read at
run time. Changing it means rebuilding the web image:

```bash
docker compose --env-file .env.docker up -d --build web
```

## In front of it

The `caddy` service is the only one facing the internet. It terminates TLS for
both hostnames — obtaining and renewing the certificates itself — and forwards
over the compose network:

- `esahist.ro` → `web:3000`
- `game.esahist.ro` → `game:2567`, **WebSocket upgrades included**. Caddy passes
  an Upgrade through in place, which is why `docker/Caddyfile` says nothing about
  it; a proxy that only forwards HTTP would let players load the board and never
  make a move.

It needs `SITE_DOMAIN`, `GAME_DOMAIN` and `ACME_EMAIL`, and nothing else.

The other three services publish ports on the host too — 3000, 2567, 3306 — but
every one of them is bound to `127.0.0.1`, and nothing depends on them. They are
for reaching a container from the machine itself, for `drizzle-kit` or a
`mysqldump`. None of it should ever be exposed beyond loopback.

Standing this up on a fresh server, from DNS to the first certificate, is walked
through in [`../docs/DEPLOY.md`](../docs/DEPLOY.md).

## Deploying a new version

```bash
git pull
docker compose --env-file .env.docker --profile migrate run --rm migrate   # if the schema moved
docker compose --env-file .env.docker up -d --build
```

The game server drains rather than dying: on `SIGTERM` Colyseus waits for every
room to dispose, so games in progress get their `onBeforeShutdown` and are
persisted. `stop_grace_period` is 90s to allow for it. Players in a game at that
moment keep playing until it ends or they leave.

The app has no such constraint and can be replaced at will.

## Checking on it

```bash
docker compose --env-file .env.docker ps          # health of each container
docker compose --env-file .env.docker logs -f game
curl -s localhost:3000/api/health
curl -s localhost:2567/health
```

Both health endpoints answer from memory and touch nothing else. That is
deliberate: a check that reaches for the database turns a database blip into a
restart loop, killing containers that were serving fine.

The Colyseus dashboard at `/monitor` lists live rooms and their state, which is
how you would confirm a player is being authenticated rather than seated as a
guest. It mounts only when `MONITOR_PASSWORD` is set, and it can dispose live
rooms, so keep it behind the proxy.

## Backups

```bash
docker compose --env-file .env.docker exec mysql \
  mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines chess \
  > backup-$(date +%F).sql
```

`--single-transaction` so the dump is consistent without locking players out
mid-game.

## Before v1

The `migrate` service runs `pnpm db:push`, which reconciles the database against
`schema.ts`. That is what this project has used in development, and it is fine
for a database nobody is depending on yet — but it compares and applies, it does
not record what it did, so there is no history and nothing to replay or roll
back.

Once real accounts exist, move to generated SQL:

```bash
pnpm db:generate          # writes drizzle/, commit it
```

and change the `migrate` service's command to `pnpm db:migrate`. The files are
then reviewable in a pull request, applied in order, and identical on every
environment.
