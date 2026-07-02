# ComplyX — Claude Code Context

**Project:** ضامن (ComplyX) — SAMA Compliance AI Agent for AMAD Hackathon 2026  
**Organized by:** Alinma Bank (الإنماء) + Tuwaiq Academy  
**Track:** Financial Regulations

## Two-Tier Coordination System

**This file (CLAUDE.md)** is the cross-machine coordination layer. It lives inside the git repo and is the single source of truth for all Claude instances regardless of which machine they run on. Any progress, decisions, or plan changes that need to be visible to another machine MUST be written here and committed before the session ends.

**The `agent/` folder** at `../../agent/` (i.e. `<repo-root>/../agent/` — outside the git repo) is the local-machine layer. It is NOT in git and NOT visible to other machines. It tracks session-local state for Claude instances running on THIS machine only — continuity between sessions on the same box.

> **Rule:** If another teammate or another machine needs to know it → write it in CLAUDE.md and commit.  
> If it's only for your next session on the same machine → write it in `../../agent/HANDOFF.md`.

## Read This First

Before touching any code:
1. Read the **Current State**, **Phase Plan**, and **Locked Decisions** sections below — these are the cross-machine shared state.
2. Then check `../../agent/HANDOFF.md` — local notes from the last session on THIS machine (may not exist if this is a new machine or first session).

## What This Repo Is

A SAMA (Saudi Central Bank) compliance AI agent. Users paste a financial product description, the system checks it against SAMA regulations and Shariah standards via RAG + LangGraph, and returns a cited compliance report with gap analysis.

## Current State (as of 2026-07-02 — update this section + commit when a phase changes)

**Frontend — COMPLETE and CONNECTED to real backend.**
Located in `frontend/`. Next.js 15, Arabic RTL, all components done AND wired to live FastAPI.
- `frontend/components/ComplianceChecker.tsx` — main UI; fully connected to real API (no mock). Concurrent animation + API: `apiResultRef` / `animationFinishedRef` refs so whichever finishes last calls `finishScan()`. 2.5s hold on scan view so user reads regulation titles before report appears. Slot count is dynamic (`complianceResult.findings.length`), not hardcoded 6.
- `frontend/components/AgentSteps.tsx` — live step visualization
- `frontend/components/ChatConsultation.tsx` — regulatory chat
- `frontend/components/ComplianceReport.tsx` — report display + download
- `frontend/lib/types.ts` — TypeScript types **your Pydantic models must match exactly**
- `frontend/lib/api.ts` — `checkCompliance(desc, productType, tone, lang)` — real API call, no mock
- `frontend/app/api/check/route.ts` — proxies to FastAPI

**Backend — COMPLETE (single-call RAG, bilingual, LangSmith traced).**
Located in `backend/app/`. All files exist and are working.
- `config.py` — pydantic-settings, reads `.env` via absolute path (critical — see HANDOFF)
- `models.py` — Pydantic models with `tone` + `lang` on CheckRequest; `disclaimer` + `agent_steps` on ComplianceResult
- `embeddings.py` — multilingual-e5-large, `query:` / `passage:` prefixes
- `retriever.py` — Qdrant client, uses `query_points()` (qdrant-client 2.x)
- `ingest.py` — PDF → chunks → Qdrant; run once per machine to populate the DB
- `llm.py` — Claude Sonnet 4.6, `temperature=0`, `tool_use` forced output, `max_tokens=8192`, LangSmith `@traceable`, bilingual (Arabic/English system prompts + req_title language), retrieval limit 16
- `main.py` — FastAPI app, CORS, startup health check
- `routes/check.py` — POST /api/check (retrieval limit 16 chunks)
- `routes/chat.py` — POST /api/chat

**Eval Harness — NEW.**
- `backend/tests/eval_run.py` — 20-product evaluation harness with manual source faithfulness metric (replaced RAGAS — incompatible with Anthropic). Stores `_retrieved_sources` and `_finding_sources` per product for faithfulness calculation.
- `backend/tests/synthetic_products.json` — 20 synthetic Arabic/English products across 4 types
- `backend/tests/eval_results.json` — results from completed 20-product run

**Eval Results (20/20 passed, retrieval limit=8, 2026-07-02):**
- Avg latency: 76.5s | P95: ~100s (inherent to Claude API; frame as dev env without GPU/caching)
- Source faithfulness: not computed in stored results (the `_retrieved_sources` private fields were stripped before saving)
- Notable: p08 score=28/high, p11 score=18/high — appropriately low for non-compliant products; p01–p07 cluster around 62/medium

**Qdrant state:** 618 chunks from 8 English SAMA PDFs. Local to each machine — run ingest per machine (see setup below).

**NOT YET DONE (deprioritized for hackathon submission):**
- LangGraph multi-tool agent (Phase 1) — still using single Claude call
- PostgreSQL audit log (Phase 2)
- WeasyPrint PDF export (Phase 2)
- Voice and upload modes in frontend (feature exists in UI but not connected to backend)
- SDAIA PDPL PDFs not yet indexed
- AAOIFI Shariah Standards PDF not yet indexed

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

## Phase Plan

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 0A | Frontend (Next.js RTL, all components) | ✅ Complete |
| 0B | Backend skeleton (FastAPI, Qdrant, single Claude call) | ✅ Complete |
| B | Frontend connected to real backend; bilingual; UI fixes; eval harness | ✅ Complete (2026-07-02) |
| 1 | LangGraph multi-tool agent replacing single Claude call | ⬜ Deferred — hackathon submitted |
| 2 | PostgreSQL audit log + WeasyPrint PDF export | ⬜ Deferred |
| 3 | Additional regulation sources (SDAIA PDPL, AAOIFI Shariah Standards) | ⬜ Deferred |

**Status:** Hackathon submission build complete. All core features working end-to-end. Deferred phases are post-submission improvements.

## Locked Decisions

Do not re-derive or debate these. They are set.

- **Embeddings:** `multilingual-e5-large` with `query:` / `passage:` prefixes — chosen for Arabic+English bilingual support, runs locally (no data egress)
- **Vector DB:** Qdrant self-hosted — data residency requirement; Pinecone is explicitly rejected
- **LLM:** Claude Sonnet 4.6, `temperature=0`, `tool_use` forced for structured output — not OpenAI (data egress), not text-parsed JSON (unreliable)
- **PDF parsing:** PyMuPDF — no LlamaIndex (unnecessary abstraction)
- **Auth:** FastAPI JWT — no Keycloak (rejected, too heavy for hackathon)
- **Frontend:** Not to be rebuilt. Next.js 15, Arabic RTL. Done.
- **Pydantic ↔ TypeScript contract:** `backend/app/models.py` must exactly match `frontend/lib/types.ts`. Change both together or neither.

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

## `llm.py` Implementation Notes

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

## Regulation Data Sources

All PDFs live in `backend/data/regulations/` (not in git — large files). After adding new PDFs, re-run `python -m app.ingest --dir data/regulations` to re-index.

**SAMA (Saudi Central Bank)** — https://rulebook.sama.gov.sa (English PDFs, publicly available)
8 PDFs currently indexed (618 chunks):
- `All_Financial_Institutions_SAMA_Rulebook.pdf`
- `Banking_Sector_SAMA_Rulebook.pdf`
- `Credit_Bureaus_SAMA_Rulebook.pdf`
- `Finance_Sector_SAMA_Rulebook.pdf`
- `Laws_and_Implementing_SAMA_Rulebook.pdf`
- `Money_Exchange_Sector_SAMA_Rulebook.pdf`
- `Payment_Systems_and_Payment_Services_Providers_SAMA_Rulebook.pdf`
- `Regulatory_Sandbox_SAMA_Rulebook.pdf`

**SDAIA (Personal Data Protection)** — https://sdaia.gov.sa — PDFs to be added (not yet indexed):
- `PDPL_Personal_Data_Protection_Law.pdf` — The articles of the PDPL
- `PDPL_Implementing_Regulation.pdf` — Implementing Regulation of the PDPL
- `PDPL_Cross_Border_Transfer_Regulation.pdf` — Regulation on Personal Data Transfer Outside the Kingdom

**AAOIFI (Shariah Standards)** — PDFs to be added (not yet indexed):
- `AAOIFI_Shariah_Standards.pdf` — AAOIFI Shariah Standards for Islamic finance products

**After adding new PDFs:** Re-run ingest. The chunk count will increase. Update the startup health check expected count in `backend/app/main.py` if you hardcoded it anywhere.

## Quality Targets

**Measured (20-product eval run, 2026-07-02):**
- 20/20 products produced valid structured output (0 failures)
- Source faithfulness: not captured in stored run (private fields were stripped) — needs re-run to measure
- Response time avg: ~76.5s | P95: ~100s (inherent to Claude API for 8192-token structured output)

**Aspirational (post-hackathon):**
- Source Faithfulness: > 92% (manual metric in `eval_run.py` — NOT RAGAS, which is incompatible with Anthropic)
- Response time: < 10s (requires caching layer or prompt optimization)

**Note:** RAGAS is NOT used and will NOT work — it hardcodes OpenAI's instructor adapter and rejects Anthropic clients at runtime. Use the manual `compute_faithfulness()` in `backend/tests/eval_run.py`.

## What NOT to Do

- Do not use LlamaIndex (rejected — unnecessary abstraction)
- Do not use Keycloak (rejected — FastAPI JWT is sufficient)
- Do not use Pinecone or any managed vector DB (data residency violation)
- Do not use OpenAI embeddings (data egress violation)
