#!/bin/bash
# ComplyX one-shot demo launcher — macOS port of start-demo.ps1.
# Boots Qdrant (docker compose, named volume), the FastAPI backend and the
# Next.js frontend, verifying each layer and failing loudly if one is down.
#
# Ports: backend 8001, frontend 3002 (chosen to avoid the common 3000/8000
# defaults other local projects often use). Change BACKEND_PORT/FRONTEND_PORT
# below if you need different ports on your machine.
#
# Prerequisites (same as the Windows setup): Python 3.12+, Node.js 18+,
# Docker Desktop, a repo `.env` with ANTHROPIC_API_KEY set, backend deps
# installed (`pip install -r requirements.txt`), frontend deps installed
# (`npm install`), and the regulation PDFs already ingested into Qdrant.
# This script does not do first-time setup — it only boots what's already
# configured, and tells you exactly what's missing if something isn't.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT=8001
FRONTEND_PORT=3002

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

step() { printf "\n${CYAN}=== %s ===${NC}\n" "$1"; }
ok()   { printf "${GREEN}[ OK ]${NC} %s\n" "$1"; }
fail() { printf "\n${RED}[FAIL]${NC} %s\n" "$1"; exit 1; }

# ── 1/4 Docker + Qdrant ──────────────────────────────────────────────────
step "1/4 Docker + Qdrant"
docker info >/dev/null 2>&1 || fail "Docker Desktop is not running. Start it and retry."

(cd "$ROOT" && docker compose up -d qdrant) >/dev/null

qdrant_up=false
for _ in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:6333/collections" >/dev/null 2>&1; then
    qdrant_up=true
    break
  fi
  sleep 1
done
[ "$qdrant_up" = true ] || fail "Qdrant did not come up on port 6333."
ok "Qdrant is up (port 6333)"

# ── 2/4 Backend (FastAPI) ────────────────────────────────────────────────
step "2/4 Backend (FastAPI, port $BACKEND_PORT)"
[ -f "$ROOT/.env" ] || fail "Missing .env in $ROOT (copy .env.example and set ANTHROPIC_API_KEY)."

BACKEND_SCRIPT="$ROOT/.demo-backend.sh"
cat > "$BACKEND_SCRIPT" <<EOF
#!/bin/bash
cd "$ROOT/backend"
exec uvicorn app.main:app --port $BACKEND_PORT --host 0.0.0.0
EOF
chmod +x "$BACKEND_SCRIPT"

osascript <<APPLESCRIPT
tell application "Terminal"
    activate
    do script "bash '$BACKEND_SCRIPT'"
end tell
APPLESCRIPT

health_json=""
for _ in $(seq 1 45); do
  if health_json=$(curl -fsS "http://127.0.0.1:$BACKEND_PORT/health" 2>/dev/null); then
    break
  fi
  health_json=""
  sleep 2
done
[ -n "$health_json" ] || fail "Backend did not come up on port $BACKEND_PORT. Check the backend Terminal window for errors."

read -r ready articles corpus <<< "$(printf '%s' "$health_json" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(d.get('ready'), d.get('indexed_articles', ''), d.get('corpus_version', ''))
")"

[ "$ready" = "True" ] || fail "Backend is up but Qdrant is EMPTY. Run: cd backend && python -m app.ingest --dir data/regulations"
ok "Backend healthy - $articles articles indexed (corpus $corpus)"

# ── 3/4 Frontend (Next.js) ───────────────────────────────────────────────
step "3/4 Frontend (Next.js, port $FRONTEND_PORT)"
printf 'BACKEND_URL=http://127.0.0.1:%s\nPORT=%s\n' "$BACKEND_PORT" "$FRONTEND_PORT" > "$ROOT/frontend/.env.local"

FRONTEND_SCRIPT="$ROOT/.demo-frontend.sh"
cat > "$FRONTEND_SCRIPT" <<EOF
#!/bin/bash
cd "$ROOT/frontend"
export PORT=$FRONTEND_PORT
exec npm run dev
EOF
chmod +x "$FRONTEND_SCRIPT"

osascript <<APPLESCRIPT
tell application "Terminal"
    activate
    do script "bash '$FRONTEND_SCRIPT'"
end tell
APPLESCRIPT

front_up=false
for _ in $(seq 1 45); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$FRONTEND_PORT" || true)
  if [ "$code" = "200" ]; then
    front_up=true
    break
  fi
  sleep 2
done
[ "$front_up" = true ] || fail "Frontend did not come up on port $FRONTEND_PORT. Check the frontend Terminal window."
ok "Frontend is up (port $FRONTEND_PORT)"

# ── 4/4 Ready ─────────────────────────────────────────────────────────────
step "4/4 Ready"
ok "ComplyX is live: http://localhost:$FRONTEND_PORT"
open "http://localhost:$FRONTEND_PORT"
