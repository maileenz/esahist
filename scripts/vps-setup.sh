#!/usr/bin/env bash
#
# Stands the site up on a fresh Ubuntu or Debian VPS, from nothing to serving.
#
#   scp scripts/vps-setup.sh root@YOUR_VPS_IP:/root/
#   ssh root@YOUR_VPS_IP
#   bash vps-setup.sh
#
# Run it as root. It is safe to run again — every phase checks whether its work
# is already done and skips it, so the normal path is to run it, do the one
# manual thing it asks for, and run it again.
#
# It stops for two things it cannot do for you:
#
#   1. Adding the generated deploy key to GitHub, so the server can clone.
#   2. Creating the DNS records, so Let's Encrypt can reach this machine.
#
# The long-form version of all of this, with the reasoning, is docs/DEPLOY.md.
#
# Options:
#   --skip-dns    Do not check that the domains resolve here. Use this if the
#                 machine is behind NAT and its public address is not the one on
#                 its interface.
#   --help
#
# Non-interactive: export SITE_DOMAIN, GAME_DOMAIN, ACME_EMAIL and the four
# AUTH_* values beforehand and nothing will prompt.

set -euo pipefail

# ---------------------------------------------------------------- settings

REPO="${REPO:-git@github.com:maileenz/grand-master.git}"
APP_USER="${APP_USER:-deploy}"
APP_DIR="${APP_DIR:-/home/$APP_USER/esahist}"

SKIP_DNS=0

# ----------------------------------------------------------------- output

BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; YELLOW=$'\033[33m'
GREEN=$'\033[32m'; RESET=$'\033[0m'

step()  { printf '\n%s==> %s%s\n' "$BOLD" "$*" "$RESET"; }
say()   { printf '    %s\n' "$*"; }
skip()  { printf '    %s(already done: %s)%s\n' "$DIM" "$*" "$RESET"; }
ok()    { printf '    %s✓%s %s\n' "$GREEN" "$RESET" "$*"; }
warn()  { printf '    %s!%s %s\n' "$YELLOW" "$RESET" "$*"; }
die()   { printf '\n%serror:%s %s\n\n' "$RED" "$RESET" "$*" >&2; exit 1; }

have()  { command -v "$1" >/dev/null 2>&1; }

# Prompt, unless the answer is already in the environment. Never echoes a
# secret back to the terminal.
ask() {
	local var="$1" prompt="$2" secret="${3:-}" current="${!1:-}" reply
	if [ -n "$current" ]; then return 0; fi
	if [ ! -t 0 ]; then
		die "$var is not set and there is no terminal to ask on. Export it and re-run."
	fi
	if [ -n "$secret" ]; then
		read -r -s -p "    $prompt: " reply; echo
	else
		read -r -p "    $prompt: " reply
	fi
	printf -v "$var" '%s' "$reply"
}

for arg in "$@"; do
	case "$arg" in
		--skip-dns) SKIP_DNS=1 ;;
		--help|-h) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;;
		*) die "unknown option: $arg" ;;
	esac
done

# --------------------------------------------------------------- preflight

step "Checking where we are"

[ "$(id -u)" -eq 0 ] || die "run this as root — it creates a user and installs packages"
have apt-get || die "this script is for Ubuntu or Debian; everything it does is possible elsewhere, just not with apt"
ok "root on $(. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME" || echo "an apt system")"

# ------------------------------------------------------------ system setup

step "Creating the $APP_USER user"

if id -u "$APP_USER" >/dev/null 2>&1; then
	skip "user exists"
else
	adduser --disabled-password --gecos "" "$APP_USER"
	usermod -aG sudo "$APP_USER"
	# Carry over whatever key you are logged in with, so you can reach the new
	# user the same way you reached root.
	if [ -d /root/.ssh ]; then
		mkdir -p "/home/$APP_USER/.ssh"
		cp -f /root/.ssh/authorized_keys "/home/$APP_USER/.ssh/" 2>/dev/null || true
		chown -R "$APP_USER:$APP_USER" "/home/$APP_USER/.ssh"
		chmod 700 "/home/$APP_USER/.ssh"
	fi
	ok "created $APP_USER, in the sudo group"
	warn "confirm 'ssh $APP_USER@this-host' works before you close your root session"
fi

step "Firewall"

if ! have ufw; then
	apt-get update -qq
	DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ufw >/dev/null
fi

if ufw status | grep -q "Status: active"; then
	skip "ufw is active"
else
	# SSH first, and from the port sshd is actually on — enabling ufw without
	# this is how a remote machine becomes someone else's problem.
	ssh_port="$(awk '/^[[:space:]]*Port[[:space:]]+[0-9]+/ {print $2; exit}' /etc/ssh/sshd_config 2>/dev/null || true)"
	ufw allow "${ssh_port:-22}/tcp" >/dev/null
	ufw allow 80/tcp >/dev/null
	ufw allow 443/tcp >/dev/null
	ufw --force enable >/dev/null
	ok "ufw allowing ${ssh_port:-22}, 80, 443"
fi

# Worth saying plainly, because it surprises people: Docker writes its own
# iptables rules ahead of ufw's, so a published container port is reachable
# whether ufw likes it or not. What keeps MySQL private is the 127.0.0.1:
# prefix in docker-compose.yml, not this firewall.
say "${DIM}(ufw does not filter Docker-published ports; the loopback bindings do)${RESET}"

step "Swap"

ram_mb="$(free -m | awk '/^Mem:/ {print $2}')"
if [ "$(free -m | awk '/^Swap:/ {print $2}')" -gt 0 ]; then
	skip "swap is already on"
elif [ "$ram_mb" -ge 4000 ]; then
	skip "${ram_mb}MB of RAM, enough for the build"
else
	fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096 status=none
	chmod 600 /swapfile
	mkswap /swapfile >/dev/null
	swapon /swapfile
	grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
	ok "4G of swap added — ${ram_mb}MB of RAM is tight for the Next.js build"
fi

step "Docker"

if have docker && docker compose version >/dev/null 2>&1; then
	skip "$(docker --version)"
else
	# Docker's own installer. The distro's docker.io package lags and does not
	# ship Compose v2, which everything below assumes.
	curl -fsSL https://get.docker.com | sh
	ok "$(docker --version)"
fi
usermod -aG docker "$APP_USER"

# ----------------------------------------------------------- the deploy key

step "Deploy key"

key="/home/$APP_USER/.ssh/id_ed25519"
if [ ! -f "$key" ]; then
	sudo -u "$APP_USER" ssh-keygen -t ed25519 -C "esahist deploy" -f "$key" -N "" -q
	ok "generated"
else
	skip "key exists"
fi

# Without this the first clone stops on an interactive host-key prompt.
known="/home/$APP_USER/.ssh/known_hosts"
if ! sudo -u "$APP_USER" ssh-keygen -F github.com -f "$known" >/dev/null 2>&1; then
	ssh-keyscan -t ed25519 github.com 2>/dev/null >> "$known"
	chown "$APP_USER:$APP_USER" "$known"
fi

# GitHub always answers this with an error; what matters is *which* error.
if sudo -u "$APP_USER" ssh -o BatchMode=yes -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
	ok "GitHub accepts this key"
else
	echo
	warn "GitHub does not know this key yet. Add it, then run this script again."
	echo
	printf '%s' "$BOLD"
	cat "$key.pub"
	printf '%s' "$RESET"
	echo
	say "GitHub → the repository → Settings → Deploy keys → Add deploy key."
	say "Leave 'Allow write access' unchecked; this key only ever pulls."
	echo
	exit 0
fi

# ------------------------------------------------------------------ code

step "Source"

if [ -d "$APP_DIR/.git" ]; then
	sudo -u "$APP_USER" git -C "$APP_DIR" pull --ff-only
	ok "updated to $(sudo -u "$APP_USER" git -C "$APP_DIR" rev-parse --short HEAD)"
else
	sudo -u "$APP_USER" git clone "$REPO" "$APP_DIR"
	ok "cloned into $APP_DIR"
fi

cd "$APP_DIR"
[ -f docker-compose.yml ] || die "no docker-compose.yml in $APP_DIR — is REPO right?"

# Compose runs as root: root can always reach the Docker socket, whereas the
# deploy user's new docker group membership does not apply to sessions that
# already existed. Git stays with the deploy user, which owns the files.
dc() { docker compose --env-file "$APP_DIR/.env.docker" "$@"; }

env_get() { grep -E "^$1=" "$APP_DIR/.env.docker" 2>/dev/null | head -1 | cut -d= -f2-; }

# --------------------------------------------------------------- configure

step "Configuration"

if [ -f "$APP_DIR/.env.docker" ]; then
	skip ".env.docker exists — leaving it alone"
	SITE_DOMAIN="$(env_get SITE_DOMAIN)"
	GAME_DOMAIN="$(env_get GAME_DOMAIN)"
	[ -n "$SITE_DOMAIN" ] || die ".env.docker has no SITE_DOMAIN. Add SITE_DOMAIN, GAME_DOMAIN and ACME_EMAIL to it, or delete the file and re-run to have it rebuilt."
else
	say "Nothing here yet, so let's write it. Secrets are generated, not asked for."
	echo
	ask SITE_DOMAIN  "Site domain            [esahist.ro]"
	ask GAME_DOMAIN  "Game server subdomain  [game.esahist.ro]"
	ask ACME_EMAIL   "Email for Let's Encrypt"
	SITE_DOMAIN="${SITE_DOMAIN:-esahist.ro}"
	GAME_DOMAIN="${GAME_DOMAIN:-game.$SITE_DOMAIN}"
	[ -n "${ACME_EMAIL:-}" ] || die "ACME_EMAIL is required — Caddy will not start without it"

	echo
	say "OAuth. These four are not optional: the app validates them at startup"
	say "and exits if any is missing. Redirect URIs are printed at the end."
	echo
	ask AUTH_DISCORD_ID     "Discord client id"
	ask AUTH_DISCORD_SECRET "Discord client secret" secret
	ask AUTH_GITHUB_ID      "GitHub client id"
	ask AUTH_GITHUB_SECRET  "GitHub client secret" secret
	for v in AUTH_DISCORD_ID AUTH_DISCORD_SECRET AUTH_GITHUB_ID AUTH_GITHUB_SECRET; do
		[ -n "${!v:-}" ] || die "$v is required — the web container will not boot without it"
	done

	umask 077
	cat > "$APP_DIR/.env.docker" <<ENVFILE
# Written by scripts/vps-setup.sh on $(date -u +%Y-%m-%dT%H:%MZ).
# Every value is explained in .env.docker.example.

MYSQL_ROOT_PASSWORD=$(openssl rand -base64 24)
MYSQL_PASSWORD=$(openssl rand -base64 24)
MYSQL_DATABASE=chess
MYSQL_USER=chess

SITE_DOMAIN=$SITE_DOMAIN
GAME_DOMAIN=$GAME_DOMAIN
ACME_EMAIL=$ACME_EMAIL

WEB_HOST_PORT=3000
GAME_HOST_PORT=2567
MYSQL_HOST_PORT=3306

# These four have to agree, or every player is quietly seated as a guest.
AUTH_URL=https://$SITE_DOMAIN
AUTH_COOKIE_DOMAIN=.$SITE_DOMAIN
NEXT_PUBLIC_GAME_SERVER_URL=https://$GAME_DOMAIN
ALLOWED_ORIGINS=https://$SITE_DOMAIN

AUTH_SECRET=$(openssl rand -base64 32)
AUTH_DISCORD_ID=$AUTH_DISCORD_ID
AUTH_DISCORD_SECRET=$AUTH_DISCORD_SECRET
AUTH_GITHUB_ID=$AUTH_GITHUB_ID
AUTH_GITHUB_SECRET=$AUTH_GITHUB_SECRET

ALLOW_ANONYMOUS=false

# Set a password to mount the Colyseus dashboard at /monitor. Empty means it is
# not mounted at all, which is the right default for a public host.
MONITOR_USER=admin
MONITOR_PASSWORD=

# Optional. Fill in later and restart; the app degrades rather than failing.
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_MONTHLY=
UPLOADTHING_TOKEN=
ENVFILE
	umask 022

	chown "$APP_USER:$APP_USER" "$APP_DIR/.env.docker"
	chmod 600 "$APP_DIR/.env.docker"
	ok "wrote .env.docker — secrets generated, mode 600"
	warn "back this file up somewhere private: AUTH_SECRET signs every session"
fi

# ---------------------------------------------------------------- the DNS

step "DNS"

if [ "$SKIP_DNS" -eq 1 ]; then
	skip "--skip-dns"
else
	server_ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") print $(i + 1)}' | head -1)"
	resolve() { getent ahostsv4 "$1" 2>/dev/null | awk '{print $1}' | sort -u | head -1; }

	bad=0
	for host in "$SITE_DOMAIN" "$GAME_DOMAIN"; do
		got="$(resolve "$host")"
		if [ -z "$got" ]; then
			warn "$host does not resolve"
			bad=1
		elif [ "$got" != "$server_ip" ]; then
			warn "$host resolves to $got, not $server_ip"
			bad=1
		else
			ok "$host → $got"
		fi
	done

	if [ "$bad" -eq 1 ]; then
		echo
		say "Create these A records, all pointing at ${BOLD}$server_ip${RESET}, then run this again:"
		say "  @      → $server_ip"
		say "  game   → $server_ip"
		echo
		say "Certificates cannot be issued until they resolve: Let's Encrypt"
		say "proves you own the domain by making a request back to it."
		say "Behind NAT? Re-run with --skip-dns."
		echo
		exit 0
	fi
fi

# ----------------------------------------------------------------- launch

step "Building — this takes about ten minutes the first time"
dc build

step "Database"
dc up -d mysql
say "waiting for it to accept connections..."
for _ in $(seq 1 60); do
	state="$(dc ps --format '{{.Service}} {{.Health}}' 2>/dev/null | awk '$1 == "mysql" {print $2}')"
	[ "$state" = "healthy" ] && break
	sleep 5
done
[ "${state:-}" = "healthy" ] || die "mysql did not come up healthy — check 'docker compose logs mysql'"
ok "mysql healthy"

step "Schema"

# `db:push` reconciles the database against schema.ts. It compares and applies
# without recording what it did, which is fine against an empty database and
# is not something to run unattended over one with accounts in it. So: only on
# the first boot, and by hand after that.
tables="$(dc exec -T mysql sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" -N -B -e "select count(*) from information_schema.tables where table_schema = \"$MYSQL_DATABASE\""' 2>/dev/null | tr -d '\r' || echo 0)"

if [ "${tables:-0}" -eq 0 ]; then
	dc --profile migrate run --rm migrate
	ok "schema created"
else
	skip "$tables tables already exist"
	say "${DIM}schema changes are deliberate: dc --profile migrate run --rm migrate${RESET}"
fi

step "Starting everything"
dc up -d
sleep 5
dc ps

step "Certificates"
say "Caddy asks Let's Encrypt for one per hostname on first start."
for _ in $(seq 1 24); do
	if dc logs caddy 2>&1 | grep -q "certificate obtained successfully"; then
		ok "issued"
		break
	fi
	sleep 5
done
dc logs caddy 2>&1 | grep -q "certificate obtained successfully" \
	|| warn "not yet — watch 'docker compose logs -f caddy'. Usually DNS, or port 80 blocked by a panel firewall."

# ----------------------------------------------------------------- verify

step "Checking it from the outside"

check() {
	local url="$1" code
	code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$url" || echo 000)"
	case "$code" in
		2*|3*) ok "$url → $code" ;;
		*)     warn "$url → $code" ;;
	esac
}

check "https://$SITE_DOMAIN/api/health"
check "https://$GAME_DOMAIN/health"
check "https://$SITE_DOMAIN/"

# --------------------------------------------------------------- what next

cat <<SUMMARY

$BOLD  Done.$RESET

  The site       https://$SITE_DOMAIN
  Game server    https://$GAME_DOMAIN
  Directory      $APP_DIR

$BOLD  Still yours to do$RESET

  Point the OAuth apps at this deployment, or nobody can sign in:

    Discord   https://$SITE_DOMAIN/api/auth/callback/discord
    GitHub    https://$SITE_DOMAIN/api/auth/callback/github
    Stripe    https://$SITE_DOMAIN/api/stripe/webhook   (optional)

  Then the test that actually proves the deployment: open the site in two
  different browsers, sign in as two accounts, and start a game between them.
  If both player bars show real usernames, the session cookie is reaching the
  game server on its subdomain. "Guest" in either seat means it is not.

$BOLD  From here on$RESET

    cd $APP_DIR
    alias dc='docker compose --env-file .env.docker'

    dc ps                  # health of each container
    dc logs -f game        # follow one
    git pull && dc up -d --build     # deploy a change

  The long version, including backups and what to do when something breaks,
  is docs/DEPLOY.md in this directory.

SUMMARY
