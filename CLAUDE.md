# ComplyX — Claude Code Context

**Project:** ضامن (ComplyX) — SAMA Compliance AI Agent for AMAD Hackathon 2026  
**Organized by:** Alinma Bank (الإنماء) + Tuwaiq Academy  
**Track:** Financial Regulations

## Read This First

Before touching any code, read these files in order:
1. `../../agent/HANDOFF.md` — what was done last session, what's next, what failed
2. `../../agent/DECISIONS.md` — locked architecture decisions (do not re-derive)
3. `../../agent/PLAN.md` — phased plan with deliverables

## What This Repo Is

A SAMA (Saudi Central Bank) compliance AI agent. Users paste a financial product description, the system checks it against SAMA regulations and Shariah standards via RAG + LangGraph, and returns a cited compliance report with gap analysis.

## Current State (as of 2026-07-01 — check HANDOFF.md for latest)

**Frontend — COMPLETE. Do not rebuild it.**
Located in `frontend/`. Built by a teammate. Next.js 15, Arabic RTL, all components done.
- `frontend/components/ComplianceChecker.tsx` — main UI
- `frontend/components/AgentSteps.tsx` — live step visualization
- `frontend/components/ChatConsultation.tsx` — regulatory chat
- `frontend/components/ComplianceReport.tsx` — report display + download
- `frontend/lib/types.ts` — TypeScript types **your Pydantic models must match exactly**
- `frontend/lib/mockCompliance.ts` — keyword mock (fallback when BACKEND_URL is unset)
- `frontend/app/api/check/route.ts` — proxies to FastAPI, falls back to mock
- `frontend/app/api/chat/route.ts` — proxies to FastAPI, falls back to mock

**Backend — BUILT (Phase 0B complete).**
Located in `backend/app/`. All files exist and are working.
- `config.py` — pydantic-settings, reads `.env` via absolute path (critical — see HANDOFF)
- `models.py` — Pydantic models matching `frontend/lib/types.ts` exactly
- `embeddings.py` — multilingual-e5-large, `query:` / `passage:` prefixes
- `retriever.py` — Qdrant client, uses `query_points()` (qdrant-client 2.x)
- `ingest.py` — PDF → chunks → Qdrant; run once per machine to populate the DB
- `llm.py` — Claude Sonnet 4.6 with `temperature=0`, `tool_use` for structured output
- `main.py` — FastAPI app, CORS, startup health check
- `routes/check.py` — POST /api/check
- `routes/chat.py` — POST /api/chat

**Qdrant state:** 618 chunks from 8 English SAMA PDFs. This is local to each machine — your friend must run ingest on their machine too (see setup below).

## New Team Member / New Machine Setup

**Prerequisites:** Python 3.12, Node.js 18+, Docker Desktop

**Step 1 — Create `.env`** in `Application/ComplyX/` (copy from `.env.example`):
```
ANTHROPIC_API_KEY=sk-ant-...
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION=sama_regulations
```

**Step 2 — Get SAMA PDFs** — obtain the 8 PDFs from your teammate and place them in `backend/data/regulations/`. They are not in the repo (large files, public documents). Download from https://rulebook.sama.gov.sa if needed.

**Step 3 — Start Qdrant:**
```powershell
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

**Step 4 — Install Python deps and run ingest** (from `backend/`):
```powershell
pip install -r requirements.txt
python -m app.ingest --dir data/regulations
```
First run downloads the multilingual-e5-large model (~1.1GB) — takes 10–30 min depending on internet/GPU. Watch for `Indexed X chunks total` at the end. Expected: ~618 chunks.

**Step 5 — Start backend** (from `backend/`):
```powershell
uvicorn app.main:app --reload --port 8000 --host 0.0.0.0
```
Expected startup line: `[startup] Qdrant ready — 618 articles indexed`
Verify: `http://127.0.0.1:8000/health` → `{"status":"ok","indexed_articles":618,"ready":true}`

**Step 6 — Start frontend** (from `frontend/`):
```powershell
npm install
$env:BACKEND_URL = "http://127.0.0.1:8000"
npm run dev
```
Open `http://localhost:3000`

**Windows-specific gotchas (read before debugging):**
- Use `--host 0.0.0.0` for uvicorn — Windows resolves `localhost` to IPv6 `::1` but uvicorn binds IPv4 only
- Use `http://127.0.0.1:8000` not `http://localhost:8000` for BACKEND_URL — same reason
- Set `$env:BACKEND_URL` in the same PowerShell session as `npm run dev` — do NOT use `echo > .env.local` (PowerShell creates UTF-16 files that Node.js can't read)
- If you see `BACKEND_URL = NOT SET — using mock` in the Next.js terminal, BACKEND_URL wasn't set before starting Next.js. Stop, set it, restart.

## Architecture (locked)

```
User → Next.js frontend
       ↓ /api/check (proxied to FastAPI)
FastAPI backend
  ↓
LangGraph agent (Phase 1 — not yet built):
  Tool 1: regulation_retriever → Qdrant semantic search
  Tool 2: requirement_extractor → Claude Sonnet 4.6
  Tool 3: gap_checker → Claude Sonnet 4.6
  Tool 4: report_generator → Claude Sonnet 4.6
  ↓
PostgreSQL audit log (Phase 2)
```

Current Phase 0B: single Claude call replaces the full LangGraph agent. Works end-to-end.

**Stack:** Claude Sonnet 4.6 | LangGraph (Phase 1) | Qdrant (self-hosted) | multilingual-e5-large | PyMuPDF | FastAPI | PostgreSQL (Phase 2) | WeasyPrint PDF (Phase 2) | LangSmith tracing

## Critical Constraint

**The `/api/check` response JSON must exactly match `frontend/lib/types.ts`.**
Read `types.ts` before changing any Pydantic model. A mismatch breaks the UI silently.

## Key Design Decisions in `llm.py`

- `temperature=0` on all Claude calls — required for deterministic compliance reports
- `tool_use` with `tool_choice={"type": "any"}` — forces structured JSON output, more reliable than text parsing
- System prompt injects exact `regulation_name` values from retrieved chunks — Claude must use these verbatim for `req_source`, preventing translation/paraphrasing between runs
- System prompt restricts Claude to only cite articles present in the retrieved context — prevents hallucinated findings from training knowledge

## Git Rules (IMPORTANT)

**Do not run git commands yourself.** At the end of your session, write down the git commands the user needs to run manually. Format:

```
## Git commands to run after this session:
git add <specific files>
git commit -m "feat: description"
git push
```

Never `git add .` or `git add -A` — always be specific about which files to stage.
Never commit `.env`, `backend/data/regulations/*.pdf`, or `frontend/.env.local`.

## SAMA Regulations — Data Sources

Primary source: https://rulebook.sama.gov.sa (English PDFs, publicly available)
8 PDFs currently indexed — ask your teammate for the exact filenames/list.

**If asked where SAMA PDFs are:** Ask the user. Do not fabricate PDF paths.

## Quality Targets (do not ship without meeting)

- RAGAS Faithfulness: > 92%
- RAGAS Retrieval Precision: > 85%
- Response time: < 10 seconds per full compliance check

## What NOT to Do

- Do not use LlamaIndex (rejected — unnecessary abstraction)
- Do not use Keycloak (rejected — FastAPI JWT is sufficient)
- Do not use Pinecone or any managed vector DB (data residency violation)
- Do not use OpenAI embeddings (data egress violation)
