# Deploying esahist.ro

From a bare Contabo VPS and a domain registered at datahost.ro to a site serving
real games over TLS. Follow it top to bottom once; every step ends with a check
that proves it worked before the next one depends on it.

Budget an hour, plus however long DNS takes to propagate — which is the one part
you cannot hurry, and the reason step 1 comes first.

This document is about *this* deployment. How the containers themselves work —
the build, the migration story, the domain rule — is in
[`docker/README.md`](../docker/README.md), and is not repeated here.

---

## The short way

Every step below is automated in
[`scripts/vps-setup.sh`](../scripts/vps-setup.sh). From this repository, on your
own machine:

```bash
scp scripts/vps-setup.sh root@YOUR_VPS_IP:/root/
ssh root@YOUR_VPS_IP
bash vps-setup.sh
```

It is resumable. Every phase checks whether its work is already done, so the
normal path is: run it, do the one thing it asks for, run it again. It stops
twice, for the two things it cannot do on your behalf — adding the generated
deploy key to GitHub, and creating the DNS records — and prints exactly what to
paste where.

It generates its own secrets, so nothing sensitive is typed or stored anywhere
but `.env.docker` on the server, at mode 600.

The rest of this document is the same process by hand. Read it if you would
rather understand each step than run all of them, or when the script stops
somewhere and you want to know what that phase was for.

---

## What you are building

```
                       the internet
                            |
                      :80   :443
                            |
                 +----------v-----------+
                 |        caddy         |   terminates TLS,
                 |   esahist.ro         |   holds both certificates
                 |   game.esahist.ro    |
                 +---+--------------+---+
                     |              |
          esahist.ro |              | game.esahist.ro
                     |              |
              +------v-----+  +-----v------+
              |    web     |  |    game    |
              |  Next.js   |  |  Colyseus  |
              |   :3000    |  |   :2567    |
              +------+-----+  +-----+------+
                     |              |
                     +------+-------+
                            |
                     +------v------+
                     |    mysql    |   compose network only,
                     |    :3306    |   never public
                     +-------------+
```

Four containers. Only `caddy` publishes a port to the internet; the other three
are reachable from the host on loopback and from each other by service name.

---

## 1. Point the domain at the server

Do this first. Everything after step 5 needs these names resolving, because
Let's Encrypt proves you own a domain by making a request *to* it.

### Check the delegation actually took

You pointed datahost's nameservers at Contabo. Confirm the internet agrees:

```bash
dig +short NS esahist.ro
```

You want Contabo's nameservers back — typically `ns1.contabo.net` and friends,
but copy whatever Contabo's panel lists for the zone rather than trusting that.
Still seeing datahost's? Either the change has not propagated — nameserver
changes can take up to 48 hours, though it is usually under two — or it was not
saved. There is no point continuing until this line is right.

### Create the records

In the Contabo customer control panel, under DNS Zone Management, open the zone
for `esahist.ro` and add:

| Type | Name   | Value          | TTL |
| ---- | ------ | -------------- | --- |
| A    | `@`    | your VPS IPv4  | 300 |
| A    | `game` | your VPS IPv4  | 300 |
| A    | `www`  | your VPS IPv4  | 300 |

`@` means the domain itself. Keep the TTL at 300 while you are setting up, so a
mistake costs five minutes rather than a day; raise it to 3600 once the site is
stable.

`www` is optional — Caddy redirects it to the bare domain. If you skip the
record, delete the `www` block from `docker/Caddyfile`, or Caddy will keep
trying and failing to get a certificate for a name that does not resolve.

**About AAAA records:** add one only if your VPS actually has IPv6 and the stack
is listening on it. A record pointing at an address nothing answers on is worse
than no record, because browsers try IPv6 first and sit there waiting.

If Contabo will not host a zone for a domain registered elsewhere, nothing else
in this document changes — create the same three records in datahost's own DNS
panel instead, and point the nameservers back at datahost.

### Check

```bash
dig +short esahist.ro @1.1.1.1
dig +short game.esahist.ro @1.1.1.1
```

Both must return your VPS address. Asking `1.1.1.1` directly sidesteps whatever
your own resolver cached before the records existed.

---

## 2. Prepare the server

SSH in as root the first time, using the credentials Contabo emailed you.

```bash
ssh root@YOUR_VPS_IP
```

### A user that is not root

```bash
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

Then log back in as `deploy` and confirm `sudo` works before you close the root
session — locking yourself out of a fresh VPS is recoverable, but only through
Contabo's rescue console.

### Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

**Know what this does and does not do.** Docker writes its own iptables rules
ahead of ufw's, so any port a container *publishes* is reachable from the
internet whether ufw likes it or not. What keeps MySQL private here is not this
firewall — it is the `127.0.0.1:` prefix on the port bindings in
`docker-compose.yml`. Leave those alone.

Also check whether a firewall is enabled in the Contabo panel itself, since that
one sits in front of the machine and will silently drop ACME traffic on port 80.

### Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
newgrp docker
docker compose version
```

Docker's own installer, not `apt install docker.io` — the distro package lags
and does not include Compose v2, which every command below assumes.

### Swap, if the machine is small

```bash
free -h
```

The Next.js build is the memory peak of the whole deployment. Under about 4 GB
of RAM, give it somewhere to spill:

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 3. Put the code on the server

**On your own machine first:** commit everything and push. The server clones from
GitHub, so anything sitting uncommitted locally simply will not be there.

```bash
git status          # should be clean
git push origin main
```

**On the server**, give it a key that can read the repository and nothing else:

```bash
ssh-keygen -t ed25519 -C "esahist deploy" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

Paste that into GitHub, under the repository's Settings → Deploy keys → Add
deploy key. Leave "Allow write access" unchecked: this key only ever pulls.

```bash
git clone git@github.com:maileenz/grand-master.git esahist
cd esahist
```

---

## 4. Fill in the configuration

```bash
cp .env.docker.example .env.docker
chmod 600 .env.docker
```

The example file explains every variable; read it rather than copying values
from here. Generate the secrets on the server — do not invent them, and do not
reuse the development ones:

```bash
openssl rand -base64 32     # AUTH_SECRET
openssl rand -base64 24     # MYSQL_ROOT_PASSWORD
openssl rand -base64 24     # MYSQL_PASSWORD
```

These six have to agree with each other and with the DNS records you just made.
Everything downstream of a mistake here fails quietly rather than loudly:

| Variable | Value |
| --- | --- |
| `SITE_DOMAIN` | `esahist.ro` |
| `GAME_DOMAIN` | `game.esahist.ro` |
| `AUTH_URL` | `https://esahist.ro` |
| `NEXT_PUBLIC_GAME_SERVER_URL` | `https://game.esahist.ro` |
| `AUTH_COOKIE_DOMAIN` | `.esahist.ro` |
| `ALLOWED_ORIGINS` | `https://esahist.ro` |

And set `ALLOW_ANONYMOUS=false`. It exists for local development; left `true` in
production it turns a failed sign-in into a nameless guest playing a game that
cannot be saved, instead of an error you would have noticed.

Two things you do **not** need to do:

- There is no `AUTH_TRUST_HOST` to set. Auth.js derives it — setting `AUTH_URL`
  is enough to make it trust the host the proxy forwards
  (`@auth/core/lib/utils/env.js`). Sites behind a proxy usually discover this
  the hard way, through an `UntrustedHost` error at the first sign-in.
- There is no certificate to obtain, install or renew by hand. Caddy does all
  three, the renewal included, for as long as it is running.

`.env.docker` is git-ignored and excluded from the build context, so it never
enters an image and never leaves the server. Back it up somewhere private
anyway — `AUTH_SECRET` is what every existing session is signed with, and
regenerating it signs everybody out.

---

## 5. Build and start

Every command needs `--env-file`, because without it Compose reads `.env`, which
is the development configuration. It is worth an alias:

```bash
alias dc='docker compose --env-file .env.docker'
```

Then:

```bash
dc build                              # ten minutes or so the first time
dc up -d mysql                        # let the database initialise
dc --profile migrate run --rm migrate # create the schema
dc up -d                              # everything, proxy included
dc ps
```

Migrations are a deliberate separate step, and the `migrate` service currently
runs `db:push`, which reconciles the database against `schema.ts` without
recording what it did. That is fine for a database nobody depends on yet. Before
real accounts accumulate, switch to generated migrations — see the end of
[`docker/README.md`](../docker/README.md).

All four containers should reach `healthy` or `running`. `mysql` takes longest on
first boot, because it is initialising its data directory.

---

## 6. Watch the certificates arrive

```bash
dc logs -f caddy
```

Within a few seconds of `caddy` starting you want lines saying `certificate
obtained successfully`, one per hostname. This is the moment the DNS work pays
off: Let's Encrypt resolves `esahist.ro`, connects to port 80 on this machine,
and expects Caddy to answer.

If it retries instead, the cause is almost always one of three, in this order of
likelihood: the DNS records are not resolving yet, port 80 is blocked by the
Contabo panel firewall, or the `www` block is still in the Caddyfile while no
`www` record exists.

Certificates live in the `caddy-data` volume. Keep it — `down -v` throws it away,
and Let's Encrypt issues at most five certificates per hostname per week.

---

## 7. Verify, from the outside in

Run these from your own machine, not the server. Each proves the layer beneath
it, so stop at the first failure.

```bash
# TLS and the proxy
curl -I https://esahist.ro

# the app container
curl -s https://esahist.ro/api/health

# the game container
curl -s https://game.esahist.ro/health

# the game server's HTTP matchmaking, with the app's origin
curl -sS -X POST https://game.esahist.ro/matchmake/joinOrCreate/chess \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://esahist.ro' \
  -d '{"timeControl":"blitz","ranked":false}' -i | head -20
```

That last one should return JSON, with an `access-control-allow-origin` header
naming your site. An authentication error in the body is the **correct** result
for a request carrying no session cookie — what is being checked is that the
request reached the application at all. An HTML error page or a bare 502 means it
did not.

Then the test that actually matters, and the only one that exercises the cookie:

1. Open `https://esahist.ro` in two different browsers — not two tabs, and not a
   private window sharing a profile.
2. Sign in as a different account in each.
3. Start a game between them.
4. **Look at the two player bars.** Real usernames, ratings and countries mean
   the session cookie reached the game server on its subdomain. "Guest" in either
   seat means it did not; see the table at the end.

---

## 8. Tell the third parties where the site lives

Configured outside this repository, and each silently does nothing until updated:

- **Discord**, OAuth2 redirects: `https://esahist.ro/api/auth/callback/discord`
- **GitHub**, OAuth app callback URL:
  `https://esahist.ro/api/auth/callback/github`
- **Stripe**, webhook endpoint: `https://esahist.ro/api/stripe/webhook` — then
  put the signing secret it hands back into `STRIPE_WEBHOOK_SECRET` and restart
  the app with `dc up -d web`.

---

## Living with it

### Deploying a change

```bash
cd ~/esahist
git pull
dc --profile migrate run --rm migrate   # only if the schema moved
dc up -d --build
```

The game server drains rather than dying: on `SIGTERM` Colyseus waits for every
room to dispose, so games in progress are persisted, and `stop_grace_period` is
90 seconds to allow for it. A deploy in the middle of a busy evening is slow, not
destructive.

`NEXT_PUBLIC_GAME_SERVER_URL` is compiled into the browser bundle, so changing it
needs `--build` rather than merely a restart.

### Backups

```bash
dc exec mysql sh -c 'mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines chess' > ~/backup-$(date +%F).sql
```

The password is read inside the container from its own environment rather than
typed, so it stays out of your shell history. `--single-transaction` makes the
dump consistent without locking players out mid-game. Worth a nightly cron entry
once there are accounts worth losing, writing somewhere that is not this server.

### Looking at it

```bash
dc ps
dc logs -f game
dc logs -f caddy
```

---

## When something is wrong

| Symptom | Cause | Fix |
| --- | --- | --- |
| Players seat as "Guest" | The session cookie never reached the game server | Check `AUTH_COOKIE_DOMAIN=.esahist.ro`, leading dot included, and that `NEXT_PUBLIC_GAME_SERVER_URL` is a subdomain of it. Changing the latter needs `dc up -d --build web`. |
| Caddy never gets a certificate | DNS not resolving, port 80 blocked, or a `www` block with no `www` record | `dig +short esahist.ro @1.1.1.1`; check the Contabo panel firewall |
| 502 from Caddy | The container behind it is not healthy | `dc ps`, then `dc logs web` or `dc logs game` |
| The board loads but no move is possible | The WebSocket is not getting through, or the origin is refused | Confirm `ALLOWED_ORIGINS` is exactly `https://esahist.ro`; look for the failed `wss://` connection in the browser console |
| `bind: address already in use` on 3306 | Something on the host already holds the port | Change `MYSQL_HOST_PORT` — it is a loopback convenience and nothing depends on its value |
| `MODULE_NOT_FOUND: @swc/helpers` in `web` | The `node-linker hoisted` line went missing from `docker/web.Dockerfile` | Restore it; the comment there explains why the standalone build needs it |
| Sign-in fails with `UntrustedHost` | `AUTH_URL` unset, or not matching the address in the browser | Set it to `https://esahist.ro`, scheme included, then `dc up -d web` |
