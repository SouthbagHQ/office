#!/usr/bin/env bash
# Integration test: the account-level freeze on Office's real HTTP surface, against the built
# Worker and a faithful local Identity fixture (test-fixtures/identity-fixture.mjs). The central
# status is checked fresh per request; /login and /auth/* stay reachable in every mode.
#
#   bash scripts/freeze-integration.sh          # KEEP=1 keeps the temp dir
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8808}"
FIXTURE_PORT="${FIXTURE_PORT:-8809}"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/southbag-office-freeze.XXXXXX")"
DEV_PID=""; FIXTURE_PID=""

cleanup() {
  [ -n "$FIXTURE_PID" ] && kill "$FIXTURE_PID" 2>/dev/null || true
  [ -n "$DEV_PID" ] && kill "$DEV_PID" 2>/dev/null || true; wait "$DEV_PID" 2>/dev/null || true
  [ "${KEEP:-}" = 1 ] && echo "kept $TMP" || rm -rf "$TMP"
}
trap cleanup EXIT

step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
fail() { printf '\033[31mFAIL: %s\033[0m\n' "$*"; exit 1; }
ok() { printf '\033[32mok\033[0m %s\n' "$*"; }

WR=(npx --prefix "$ROOT" wrangler)
start_fixture() { FIXTURE_SECRET=itsec node "$ROOT/test-fixtures/identity-fixture.mjs" "$FIXTURE_PORT" "$1" >"$TMP/fixture.log" 2>&1 & FIXTURE_PID=$!; sleep 1; }
stop_fixture() { [ -n "$FIXTURE_PID" ] && kill "$FIXTURE_PID" 2>/dev/null || true; wait "$FIXTURE_PID" 2>/dev/null || true; FIXTURE_PID=""; }

step "build"
(cd "$ROOT" && npx vite build >/dev/null 2>&1) || fail "vite build failed"

step "session cookie (HMAC, same shape as src/lib/server/session.ts)"
node - "$TMP/cookie.txt" <<'EOF'
import { writeFileSync } from 'node:fs';
const [,, out] = process.argv;
const secret = 'testsec';
const b64u = (bytes) => Buffer.from(bytes).toString('base64url');
const payload = b64u(JSON.stringify({ user: { sub: 'dev-alice', name: 'Alice', email: 'alice@example.com' }, expires: Date.now() + 3600e3 }));
const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
writeFileSync(out, `${payload}.${b64u(new Uint8Array(sig))}`);
EOF
COOKIE="$(cat "$TMP/cookie.txt")"

step "office worker on :$PORT + identity fixture (active)"
start_fixture active
(cd "$ROOT" && exec "${WR[@]}" dev --port "$PORT" \
  --var SESSION_SECRET:testsec --var IDENTITY_ORIGIN:http://127.0.0.1:$FIXTURE_PORT --var IDENTITY_INTERNAL_SECRET:itsec >"$TMP/dev.log" 2>&1) &
DEV_PID=$!
for i in $(seq 1 90); do
  curl -s -o /dev/null "http://127.0.0.1:$PORT/login" && break
  sleep 1
  [ "$i" = 90 ] && fail "office worker did not start: $(tail -5 "$TMP/dev.log")"
done
ok "started"

check() { # $1 label $2 signed-in page status
  local page login logout
  page=$(curl -sL -o /dev/null -w '%{http_code}' -H "Cookie: southbag_office_session=$COOKIE" "http://127.0.0.1:$PORT/")
  login=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/login")
  logout=$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: southbag_office_session=$COOKIE" "http://127.0.0.1:$PORT/auth/logout")
  [ "$page" = "$2" ] || fail "$1: signed-in page status $page, want $2"
  [ "$login" = 200 ] || fail "$1: /login status $login, want 200 (always reachable)"
  case "$logout" in 200|302) ;; *) fail "$1: /auth/logout status $logout, want 200/302 (always reachable)";; esac
  ok "$1: page=$2 login=200 logout=$logout"
}

check "active" 200
stop_fixture; start_fixture frozen
check "frozen" 423
stop_fixture; start_fixture reject
check "secret rejected" 503
stop_fixture
check "identity down" 503
start_fixture active
check "active again (no stale cache)" 200

printf '\n\033[32mAll office freeze integration checks passed.\033[0m\n'
