#!/usr/bin/env bash
#
# Brings esahist.ro up on a fresh Ubuntu 24.04 VPS: installs what is missing,
# clones the repository, asks for the configuration it cannot invent, writes
# .env.docker, then builds and starts the containers.
#
# The repository is public, so the quickest way to get this onto the server is
# to fetch it:
#
#   curl -fsSL https://raw.githubusercontent.com/maileenz/esahist/main/scripts/init.sh -o init.sh
#   sudo bash init.sh
#
# Run it as root. It is safe to run again — every phase checks whether its work
# is already done and skips it, so if something goes wrong you fix that one
# thing and run it again rather than starting over.
#
# It stops for the one thing it cannot do for you: creating the DNS records, so
# that Let's Encrypt can reach this machine and issue the certificates.
#
# Options:
#   --skip-dns    Do not check that the domains resolve here. For a machine
#                 behind NAT, whose public address is not the one on its
#                 interface.
#   --help
#
# Everything it does, explained at length, is docs/DEPLOY.md in the repository.

set -euo pipefail

# ---------------------------------------------------------------- settings

REPO_HTTPS="${REPO_HTTPS:-https://github.com/maileenz/esahist.git}"
REPO_SSH="${REPO_SSH:-git@github.com:maileenz/esahist.git}"
APP_USER="${APP_USER:-deploy}"
APP_DIR="${APP_DIR:-/home/$APP_USER/esahist}"

SKIP_DNS=0

# ------------------------------------------------------------------ output

BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; YELLOW=$'\033[33m'
GREEN=$'\033[32m'; RESET=$'\033[0m'

step()  { printf '\n%s==> %s%s\n' "$BOLD" "$*" "$RESET"; }
say()   { printf '    %s\n' "$*"; }
note()  { printf '    %s%s%s\n' "$DIM" "$*" "$RESET"; }
skip()  { printf '    %s(already done: %s)%s\n' "$DIM" "$*" "$RESET"; }
ok()    { printf '    %s+%s %s\n' "$GREEN" "$RESET" "$*"; }
warn()  { printf '    %s!%s %s\n' "$YELLOW" "$RESET" "$*"; }
die()   { printf '\n%serror:%s %s\n\n' "$RED" "$RESET" "$*" >&2; exit 1; }

have()  { command -v "$1" >/dev/null 2>&1; }

# One prompt.
#
#   ask VAR "label" [default] [regex] [secret] [hint]
#
# Enter alone takes the default. When a regex is given the answer must match
# before it is accepted, which is the point: a malformed Stripe key or a domain
# with https:// in front of it is far cheaper to catch here than as a container
# that boots, fails validation and restarts forever. Optional fields use a regex
# that also accepts the empty string.
#
# A value already in the environment is taken as answered, so the whole
# interview can be pre-filled for an unattended run.
ask() {
	local var="$1" label="$2" default="${3:-}" regex="${4:-}" secret="${5:-}" hint="${6:-}" reply
	[ -n "${!var:-}" ] && return 0
	[ -t 0 ] || die "$var is unset and there is no terminal to ask on — export it and re-run"

	while true; do
		if [ -n "$secret" ]; then
			read -r -s -p "    $label: " reply; echo
		elif [ -n "$default" ]; then
			read -r -p "    $label [$default]: " reply
			reply="${reply:-$default}"
		else
			read -r -p "    $label: " reply
		fi

		[ -z "$regex" ] && break
		[[ "$reply" =~ $regex ]] && break
		warn "${hint:-that does not look right}"
	done

	printf -v "$var" '%s' "$reply"
}

confirm() {
	local reply
	[ -t 0 ] || return 0
	read -r -p "    $1 [y/N]: " reply
	[[ "$reply" =~ ^[Yy] ]]
}

# A domain, not a URL: people paste the address bar, and https:// in SITE_DOMAIN
# becomes a Caddyfile that does not parse.
bare_domain() {
	local d="${1#http://}"; d="${d#https://}"; printf '%s' "${d%%/*}"
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

[ "$(id -u)" -eq 0 ] || die "run this as root — it installs packages and creates a user"
have apt-get || die "this expects Ubuntu or Debian; everything it does is possible elsewhere, just not with apt"

if [ -r /etc/os-release ]; then
	# shellcheck disable=SC1091
	. /etc/os-release
	ok "${PRETTY_NAME:-an apt system}"
	case "${VERSION_ID:-}" in
		24.04|22.04|24.10|25.04) ;;
		*) warn "written for Ubuntu 24.04; ${VERSION_ID:-this} is untested but will probably be fine" ;;
	esac
fi

# ------------------------------------------------------------------ packages

step "Base packages"

# ca-certificates installs no command of its own, so it is the one that has to
# be asked about by package name rather than by what it puts on the PATH.
need=()
have git  || need+=(git)
have curl || need+=(curl)
have ufw  || need+=(ufw)
dpkg -s ca-certificates >/dev/null 2>&1 || need+=(ca-certificates)

if [ "${#need[@]}" -eq 0 ]; then
	skip "git, curl, ufw all present"
else
	apt-get update -qq
	DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${need[@]}" >/dev/null
	ok "installed: ${need[*]}"
fi
ok "$(git --version)"

# ---------------------------------------------------------------- the user

step "The $APP_USER user"

if id -u "$APP_USER" >/dev/null 2>&1; then
	skip "exists"
else
	# The clone lives in this user's home, so it has to exist before anything is
	# fetched. No password: you reach it with the key you are already using.
	adduser --disabled-password --gecos "" "$APP_USER" >/dev/null
	usermod -aG sudo "$APP_USER"
	if [ -f /root/.ssh/authorized_keys ]; then
		install -d -m 700 -o "$APP_USER" -g "$APP_USER" "/home/$APP_USER/.ssh"
		install -m 600 -o "$APP_USER" -g "$APP_USER" /root/.ssh/authorized_keys "/home/$APP_USER/.ssh/authorized_keys"
	fi
	ok "created, in the sudo group, with your SSH key copied over"
	warn "check 'ssh $APP_USER@this-host' works before closing your root session"
fi

# ------------------------------------------------------------------ docker

step "Docker"

if have docker && docker compose version >/dev/null 2>&1; then
	skip "$(docker --version)"
else
	# Docker's own installer. Ubuntu's docker.io package lags and ships no
	# Compose v2, which is what every command below uses.
	curl -fsSL https://get.docker.com | sh >/dev/null
	ok "$(docker --version)"
fi
usermod -aG docker "$APP_USER"

# ---------------------------------------------------------------- firewall

step "Firewall and swap"

if ufw status 2>/dev/null | grep -q "Status: active"; then
	skip "ufw is active"
else
	ssh_port="$(awk '/^[[:space:]]*Port[[:space:]]+[0-9]+/ {print $2; exit}' /etc/ssh/sshd_config 2>/dev/null || true)"
	ufw allow "${ssh_port:-22}/tcp" >/dev/null
	ufw allow 80/tcp >/dev/null
	ufw allow 443/tcp >/dev/null
	ufw --force enable >/dev/null
	ok "allowing ${ssh_port:-22}, 80, 443"
fi
note "(ufw does not filter Docker-published ports; the 127.0.0.1 bindings do)"

ram_mb="$(free -m | awk '/^Mem:/ {print $2}')"
if [ "$(free -m | awk '/^Swap:/ {print $2}')" -gt 0 ]; then
	skip "swap is on"
elif [ "$ram_mb" -ge 4000 ]; then
	skip "${ram_mb}MB RAM, enough to build"
else
	fallocate -l 4G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=4096 status=none
	chmod 600 /swapfile
	mkswap /swapfile >/dev/null
	swapon /swapfile
	grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
	ok "4G swap added — the Next.js build is tight in ${ram_mb}MB"
fi

# ------------------------------------------------------------------- clone

step "The code"

if [ -d "$APP_DIR/.git" ]; then
	sudo -u "$APP_USER" git -C "$APP_DIR" pull --ff-only
	ok "updated to $(sudo -u "$APP_USER" git -C "$APP_DIR" rev-parse --short HEAD)"
else
	# Public repository: no key, no credentials. If it is ever made private this
	# falls through to SSH, which then needs a deploy key on the account.
	if GIT_TERMINAL_PROMPT=0 git ls-remote --exit-code "$REPO_HTTPS" HEAD >/dev/null 2>&1; then
		repo="$REPO_HTTPS"
	else
		repo="$REPO_SSH"
		warn "not public from here — cloning over SSH, which needs a deploy key on this machine"
	fi
	sudo -u "$APP_USER" git clone "$repo" "$APP_DIR"
	ok "cloned into $APP_DIR"
fi

cd "$APP_DIR"
[ -f docker-compose.yml ] || die "no docker-compose.yml in $APP_DIR — is the repository right?"

# Compose runs as root: root always reaches the Docker socket, whereas the
# deploy user's brand-new docker group membership does not apply to a session
# that already existed. Git stays with the deploy user, which owns the files.
dc() { docker compose --env-file "$APP_DIR/.env.docker" "$@"; }
env_get() { grep -E "^$1=" "$APP_DIR/.env.docker" 2>/dev/null | head -1 | cut -d= -f2-; }

# --------------------------------------------------------------- the values

step "Configuration"

if [ -f "$APP_DIR/.env.docker" ]; then
	skip "$APP_DIR/.env.docker exists — not touching it"
	SITE_DOMAIN="$(env_get SITE_DOMAIN)"
	GAME_DOMAIN="$(env_get GAME_DOMAIN)"
	[ -n "$SITE_DOMAIN" ] || die "that .env.docker has no SITE_DOMAIN. Add SITE_DOMAIN, GAME_DOMAIN and ACME_EMAIL, or move the file aside and run this again to have it written."
else
	say "Answers to a handful of questions, and the rest is generated."
	note "Enter alone takes the value in brackets. Passwords are never echoed."

	printf '\n%s  Where it lives%s\n' "$BOLD" "$RESET"
	ask SITE_DOMAIN "Site domain" "esahist.ro" \
		'^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$|^https?://' "" "a domain, e.g. esahist.ro"
	SITE_DOMAIN="$(bare_domain "$SITE_DOMAIN")"

	ask GAME_DOMAIN "Game server subdomain" "game.$SITE_DOMAIN" \
		'^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$|^https?://' "" "a subdomain, e.g. game.$SITE_DOMAIN"
	GAME_DOMAIN="$(bare_domain "$GAME_DOMAIN")"

	ask ACME_EMAIL "Email for Let's Encrypt" "" \
		'^[^@[:space:]]+@[^@[:space:]]+\.[A-Za-z]{2,}$' "" "an email address — Caddy will not start without one"

	printf '\n%s  Sign-in (all four required)%s\n' "$BOLD" "$RESET"
	note "The app validates these at startup and exits if any is blank."
	note "Redirect URIs are printed at the end, once the domain is known."
	ask AUTH_DISCORD_ID     "Discord client id"     "" '.+'
	ask AUTH_DISCORD_SECRET "Discord client secret" "" '.+' secret
	ask AUTH_GITHUB_ID      "GitHub client id"      "" '.+'
	ask AUTH_GITHUB_SECRET  "GitHub client secret"  "" '.+' secret

	printf '\n%s  Optional — press Enter to skip any of these%s\n' "$BOLD" "$RESET"
	note "Without Stripe the membership page says billing is not configured."
	note "Without UploadThing the profile page hides the picture control."
	# The patterns match the schema in src/env.js, which rejects a malformed key
	# at startup. Catching it here costs a retype; catching it there costs a
	# crash-loop on a live server.
	ask STRIPE_SECRET_KEY     "Stripe secret key"     "" '^$|^sk_[a-z]+_.+' "" "starts with sk_live_ or sk_test_"
	ask STRIPE_WEBHOOK_SECRET "Stripe webhook secret" "" '^$|^whsec_.+'     "" "starts with whsec_"
	ask STRIPE_PRICE_MONTHLY  "Stripe monthly price id" "" '^$|^price_.+'   "" "starts with price_"
	ask UPLOADTHING_TOKEN     "UploadThing token"     "" ''                 secret
	ask MONITOR_PASSWORD      "Password for the Colyseus /monitor dashboard" "" '' secret

	# Written here rather than asked, because these four have to agree and a
	# typo in any one of them seats every player as a guest with no error
	# anywhere. Deriving them from the two domains removes the whole class of
	# mistake.
	umask 077
	cat > "$APP_DIR/.env.docker" <<ENVFILE
# Written by scripts/init.sh on $(date -u +%Y-%m-%dT%H:%MZ).
# Every value is explained in .env.docker.example.

# ---------------------------------------------------------------- database
MYSQL_ROOT_PASSWORD=$(openssl rand -base64 24)
MYSQL_PASSWORD=$(openssl rand -base64 24)
MYSQL_DATABASE=chess
MYSQL_USER=chess

# ------------------------------------------------------------------- hosts
SITE_DOMAIN=$SITE_DOMAIN
GAME_DOMAIN=$GAME_DOMAIN
ACME_EMAIL=$ACME_EMAIL

WEB_HOST_PORT=3000
GAME_HOST_PORT=2567
MYSQL_HOST_PORT=3306

# -------------------------------------------------------------------- auth
# These four are derived from the two domains above and must stay consistent:
# the game server authenticates by reading the session cookie, and a cookie
# only travels to the domain it was issued for plus subdomains of an explicit
# parent. Break the pattern and every player is seated as a guest, silently.
AUTH_URL=https://$SITE_DOMAIN
AUTH_COOKIE_DOMAIN=.$SITE_DOMAIN
NEXT_PUBLIC_GAME_SERVER_URL=https://$GAME_DOMAIN
ALLOWED_ORIGINS=https://$SITE_DOMAIN

AUTH_SECRET=$(openssl rand -base64 32)
AUTH_DISCORD_ID=$AUTH_DISCORD_ID
AUTH_DISCORD_SECRET=$AUTH_DISCORD_SECRET
AUTH_GITHUB_ID=$AUTH_GITHUB_ID
AUTH_GITHUB_SECRET=$AUTH_GITHUB_SECRET

# Never true here: it hands out guest identities instead of refusing a failed
# sign-in, and a guest has no user row, so those games cannot be saved.
ALLOW_ANONYMOUS=false

# ------------------------------------------------------------------ extras
MONITOR_USER=admin
MONITOR_PASSWORD=$MONITOR_PASSWORD

STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_MONTHLY=$STRIPE_PRICE_MONTHLY

UPLOADTHING_TOKEN=$UPLOADTHING_TOKEN
ENVFILE
	umask 022

	chown "$APP_USER:$APP_USER" "$APP_DIR/.env.docker"
	chmod 600 "$APP_DIR/.env.docker"
	ok "wrote .env.docker — passwords generated, readable only by $APP_USER and root"
	warn "back it up somewhere private: AUTH_SECRET signs every session, and"
	warn "replacing it signs everybody out"
fi

# --------------------------------------------------------------------- DNS

step "DNS"

if [ "$SKIP_DNS" -eq 1 ]; then
	skip "--skip-dns"
else
	server_ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") print $(i + 1)}' | head -1)"
	bad=0
	for host in "$SITE_DOMAIN" "$GAME_DOMAIN"; do
		got="$(getent ahostsv4 "$host" 2>/dev/null | awk '{print $1}' | sort -u | head -1)"
		if [ -z "$got" ]; then
			warn "$host does not resolve"; bad=1
		elif [ "$got" != "$server_ip" ]; then
			warn "$host resolves to $got, not $server_ip"; bad=1
		else
			ok "$host -> $got"
		fi
	done

	if [ "$bad" -eq 1 ]; then
		echo
		say "Add these A records, both pointing at ${BOLD}$server_ip${RESET}:"
		say "  @      ->  $server_ip"
		say "  game   ->  $server_ip"
		echo
		say "Until they resolve, Caddy cannot get certificates: Let's Encrypt"
		say "proves you own the domain by making a request back to it. Everything"
		say "else will still come up, and Caddy retries on its own."
		echo
		confirm "Carry on anyway?" || exit 0
	fi
fi

# ------------------------------------------------------------------- build

step "Building the images (about ten minutes the first time)"
dc build

step "Database"
dc up -d mysql
say "waiting for it to accept connections..."
state=""
for _ in $(seq 1 60); do
	state="$(dc ps --format '{{.Service}} {{.Health}}' 2>/dev/null | awk '$1 == "mysql" {print $2}')"
	[ "$state" = "healthy" ] && break
	sleep 5
done
[ "$state" = "healthy" ] || die "mysql never became healthy — 'docker compose logs mysql' will say why"
ok "healthy"

step "Schema"

# `db:push` reconciles the database against schema.ts. It applies without
# recording what it did, which is right for an empty database and is not
# something to run unattended over one with accounts in it. So: first boot
# only, and deliberately by hand after that.
tables="$(dc exec -T mysql sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" -N -B -e "select count(*) from information_schema.tables where table_schema = \"$MYSQL_DATABASE\""' 2>/dev/null | tr -d '\r' || echo 0)"

if [ "${tables:-0}" -eq 0 ]; then
	dc --profile migrate run --rm migrate
	ok "schema created"
else
	skip "$tables tables already there"
	note "when the schema moves: dc --profile migrate run --rm migrate"
fi

step "Starting the containers"
dc up -d
sleep 5
dc ps

step "Certificates"
say "Caddy asks Let's Encrypt for one per hostname on first start."
for _ in $(seq 1 24); do
	dc logs caddy 2>&1 | grep -q "certificate obtained successfully" && break
	sleep 5
done
if dc logs caddy 2>&1 | grep -q "certificate obtained successfully"; then
	ok "issued"
else
	warn "not yet — 'docker compose logs -f caddy' will show the retries."
	warn "Usually DNS, or port 80 blocked by a firewall in the provider panel."
fi

# ------------------------------------------------------------------ verify

step "Checking it from the outside"

check() {
	local code
	code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$1" || echo 000)"
	case "$code" in
		2*|3*) ok "$1 -> $code" ;;
		*)     warn "$1 -> $code" ;;
	esac
}

check "https://$SITE_DOMAIN/"
check "https://$SITE_DOMAIN/api/health"
check "https://$GAME_DOMAIN/health"

# -------------------------------------------------------------------- done

cat <<SUMMARY

$BOLD  Up.$RESET

  Site           https://$SITE_DOMAIN
  Game server    https://$GAME_DOMAIN
  Directory      $APP_DIR

$BOLD  Two things left, and nobody can sign in until the first$RESET

  Point the OAuth apps at this deployment:

    Discord   https://$SITE_DOMAIN/api/auth/callback/discord
    GitHub    https://$SITE_DOMAIN/api/auth/callback/github
    Stripe    https://$SITE_DOMAIN/api/stripe/webhook   (only if you use it)

  Then the check that actually proves the deployment worked: open the site in
  two different browsers, sign in as two accounts, and play a game between
  them. Real usernames in both player bars means the session cookie is reaching
  the game server on its subdomain. "Guest" in either seat means it is not.

$BOLD  Day to day$RESET

    cd $APP_DIR
    alias dc='docker compose --env-file .env.docker'

    dc ps                             # what is healthy
    dc logs -f game                    # follow one
    git pull && dc up -d --build       # deploy a change

  Backups, troubleshooting and the manual version of all of this are in
  docs/DEPLOY.md.

SUMMARY
