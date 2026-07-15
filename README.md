# ComplyX (ضامن)

AI-powered regulatory compliance analysis for Saudi Arabian fintech products. Built for the **AMAD Hackathon 2026** (Alinma Bank × Tuwaiq Academy), Financial Regulations track.

Describe a financial product and ComplyX checks it against KSA regulations, returning a scored compliance report with per-article gap analysis, verbatim regulatory citations, an executive summary, and actionable recommendations. Fully bilingual (Arabic RTL and English).

---

## What It Does

1. **Describe your product**: type a description, attach a PDF/DOCX/TXT document, or dictate by voice, in Arabic or English. Scope the scan to any combination of regulators (SAMA, PDPL/SDAIA, AAOIFI Shariah, CMA).
2. **Clarification interview (step 1.5)**: the system asks up to 4 targeted multiple-choice questions about compliance-critical details missing from the description (license status, target users, data handling, and more). Answers are folded into the scan, stay visible alongside the report, and findings that depend on them are explicitly attributed ("Based on your interview answer: ...").
3. **Live analysis**: semantic search retrieves the relevant regulatory articles (shown on screen within about a second, with Arabic titles in Arabic sessions), then Claude writes findings that stream into the UI as they are produced.
4. **Scored report**: a deterministic 0-100 compliance score (computed by a fixed penalty formula with severity gates, never by the LLM), risk level, per-finding analysis and recommendation, and the exact regulation text each finding is based on (quote faithfulness 1.0 by construction). The report shows the scoring arithmetic: each finding's point impact, the dominant score driver, and a notice when a severity gate capped the score (a confirmed high-severity gap always places the product in the high-risk band; strengths elsewhere never offset a critical breach). Reports re-render instantly across language and detail level (simple / executive / technical) without the findings or score ever changing.
5. **Session-aware assistant**: a built-in chat consultant that knows your product description, uploaded document, interview answers, and generated report, and answers follow-up questions grounded in the retrieved regulations.
6. **Export**: branded bilingual PDF (remediation roadmap plus full findings) or plain-text report.

---

## Architecture

```
Browser (Next.js 15, Arabic RTL)
  │
  ├─ /api/check, /api/check-stream (SSE) ──► FastAPI backend
  ├─ /api/clarify, /api/retone, /api/chat        │
  ├─ /api/extract-text, /api/report-pdf          ├─ Qdrant (self-hosted, docker compose)
  │                                              │   └─ multilingual-e5-large embeddings
  │                                              │   └─ 9,505 regulatory chunks, 4 corpora
  │                                              │
  │                                              ├─ Claude Sonnet 4.6 (analysis, retone, chat)
  │                                              └─ Claude Haiku 4.5 (clarify, title translation)
```

**Frontend:** Next.js 15, React 19, TypeScript, CSS logical properties (full RTL/LTR)
**Backend:** FastAPI, Qdrant, `multilingual-e5-large` (local embeddings), Claude via forced `tool_use`
**Evaluation:** 20-product synthetic harness with manual source/quote faithfulness metrics

---

## Regulation Sources

All PDFs live in `backend/data/regulations/` (not in git; large, publicly available files). 17 PDFs, 9,505 indexed chunks (corpus 2026-07).

| Corpus | Regulator | PDFs | Chunks |
|--------|-----------|------|--------|
| `sama` | SAMA (Saudi Central Bank), https://rulebook.sama.gov.sa | 8 rulebooks | 5,432 |
| `shariah` | AAOIFI Shariah Standards | 1 | 3,334 |
| `cma` | Capital Market Authority | 4 (institutions regulation, Capital Market Law, Investment Funds Regulations, FinTech Lab permit instructions) | 572 |
| `pdpl` | SDAIA Personal Data Protection | 4 (law, 2 implementing regs, NDMO data management standard) | 167 |

---

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+
- Docker Desktop (for Qdrant)

### One-shot boot

```powershell
./start-demo.ps1        # Windows
```
```bash
./start-demo.sh          # macOS
```

Boots Qdrant, the backend, and the frontend with health checks at every layer and fails loudly if one is down. Each opens the backend and frontend in their own terminal window so their logs stay visible. Both scripts assume `.env`, backend/frontend dependencies, and an already-ingested Qdrant are in place — they boot services, they don't do first-time setup. For manual setup:

### 1. Environment

Copy `.env.example` to `.env` and fill in:

```
ANTHROPIC_API_KEY=sk-ant-...
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION=sama_regulations

# Optional: enables LangSmith tracing
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=ls__...
LANGCHAIN_PROJECT=complyx-amad
```

### 2. Start Qdrant (named volume; do not use a bare docker run)

```powershell
docker compose up -d qdrant
```

### 3. Ingest regulations

Place PDFs in `backend/data/regulations/`, then from `backend/`:

```powershell
pip install -r requirements.txt
python -m app.ingest --dir data/regulations
```

First run downloads `multilingual-e5-large` (~1.1 GB). Embedding the full 17-PDF corpus takes 2-4 hours on CPU. Expected final count: about 9,505 chunks.

### 4. Start backend (port 8001)

```powershell
cd backend
$env:PYTHONUTF8 = "1"
uvicorn app.main:app --port 8001 --host 0.0.0.0
```

Verify: `http://127.0.0.1:8001/health` returns `{"status":"ok","indexed_articles":9505,"ready":true,"corpus_version":"2026-07","corpora":{...}}`

### 5. Start frontend (port 3002)

```powershell
cd frontend
npm install
npm run dev
```

`frontend/.env.local` sets `BACKEND_URL=http://127.0.0.1:8001` and `PORT=3002`. Open `http://localhost:3002`.

> **Windows note:** Use `127.0.0.1` rather than `localhost` in `BACKEND_URL` to avoid IPv6 resolution issues. Ports 8001/3002 are used because 8000/3000 may be occupied on the dev machine.
>
> **macOS note:** `start-demo.sh` needs `python3` on `PATH` (already required for the backend) to parse the `/health` JSON, and uses `osascript`/Terminal.app to open the backend and frontend windows — both are standard on stock macOS, nothing extra to install. Run `chmod +x start-demo.sh` once if it isn't already executable.
>
> There is no mock fallback anywhere: if the backend is unreachable the UI shows a clear error instead of fake results.

---

## Running the Evaluation

Tests ComplyX against 20 synthetic Saudi fintech product descriptions, measuring latency plus two faithfulness metrics: **source faithfulness** (does each finding cite a retrieved regulation?) and **quote faithfulness** (does the verbatim text shown in the UI appear in a retrieved chunk?). Both are 1.0 by construction: the backend injects citations and quotes server-side from the retrieved chunks; the LLM only returns chunk indexes.

```powershell
# Smoke test: first 2 products
cd backend
$env:PYTHONUTF8 = "1"
python -m tests.eval_run --limit 2

# Full 20-product run
python -m tests.eval_run
```

Results are printed to the terminal and saved to `backend/tests/eval_results.json`.

---

## API Reference

### `POST /api/check`

Runs a full compliance scan (non-streaming).

```json
{
  "product_description": "string (min 20 chars)",
  "product_type": "payment_services | consumer_finance | open_banking | general | aml | pdpl",
  "tone": "simple | executive | technical",
  "lang": "ar | en",
  "corpora": ["sama", "pdpl", "shariah", "cma"]
}
```

`corpora` is optional (omit = search everything). Returns a `ComplianceResult`; see `backend/app/models.py` and `frontend/lib/types.ts` (kept in exact sync). The compliance score is computed deterministically from finding statuses/risks (`backend/app/scoring.py`); every finding carries the verbatim regulation text injected server-side, and findings that rely on a clarification answer carry it in `user_answer_ref`.

### `POST /api/check/stream`

Same request body; responds with Server-Sent Events: `retrieved` (the matched articles, within about 1s), `retrieved_ar` (Arabic title translations, Arabic sessions only), one `finding` event per finding as the model writes it, then `complete` with the full `ComplianceResult`, or `error` (client falls back to `/api/check`).

### `POST /api/retone`

Re-renders an existing report in a new tone and/or language without re-classifying anything.

```json
{
  "product_type": "...",
  "tone": "simple | executive | technical",
  "lang": "ar | en",
  "findings": ["...the report's findings, unchanged..."],
  "executive_summary": "the current summary (rewritten, with fallback)"
}
```

Status, risk, and score are copied from the input findings and cannot drift; only the presentation text is rewritten. The frontend caches each language/detail-level variant and prefetches the other language in the background, so switching is instant and repeated switches always show identical wording.

### `POST /api/clarify`

`{ "product_description", "product_type", "lang" }` returns 0-4 structured multiple-choice questions targeting missing compliance-critical details. The UI also has local fallback questions keyed to its coverage checklist, so the interview always appears when the checklist shows gaps.

### `POST /api/chat`

Session-aware regulatory consultation.

```json
{
  "query": "string",
  "messages": [{ "role": "user | assistant", "content": "string" }],
  "context": {
    "product_type": "...", "product_description": "...",
    "uploaded_file_name": "...", "clarified_answers": ["..."],
    "compliance_score": 0, "risk_level": "...", "gaps_count": 0,
    "findings": [{ "title": "...", "status": "...", "risk": "...", "article": "...", "source": "..." }],
    "executive_summary": "...", "lang": "ar"
  }
}
```

`context` is optional; when present the assistant answers with full awareness of the user's product, uploaded document, interview answers, and generated report.

### `POST /api/extract-text`

Multipart file upload (PDF via PyMuPDF, DOCX, TXT; max 20 MB, text capped at 8,000 chars) returning the extracted text used as the product description.

### `POST /api/report-pdf`

`{ "result": ComplianceResult, "lang": "ar|en", "product_label": "string", "session_ref": "string", "interview": [{ "question", "answer" }] }` returns a branded bilingual PDF: a cover page with score dial and stat cards, a "path to compliant" score projection (exact arithmetic from the scoring formula), findings-by-regulator summary, remediation roadmap with ownership and sign-off boxes, full findings with sentence-boundary-trimmed verbatim quotes and interview-answer attributions, an interview Q&A appendix, a scope-and-method statement, and footers carrying the session reference, disclaimer, and page numbers. `interview` and `session_ref` are optional. Requires Playwright Chromium; returns 501 with install instructions otherwise.

### `GET /health`

Backend readiness, indexed article count, corpus version, and per-corpus chunk counts. Polled by the UI's live status badge.

---

## Project Structure

```
ComplyX/
├── frontend/                   # Next.js 15 app
│   ├── app/
│   │   ├── api/                # Proxies to FastAPI (no mock fallbacks)
│   │   │   ├── check/  check-stream/  clarify/  retone/
│   │   │   ├── chat/   extract-text/  report-pdf/  health/
│   │   └── globals.css
│   ├── components/
│   │   └── ComplianceChecker.tsx   # Main UI (hero, input, interview, analysis, report, chat)
│   ├── public/regulators/      # White regulator logos (SAMA, CMA, SDAIA, AAOIFI) for the hero stripe
│   └── lib/
│       ├── api.ts              # API client incl. streaming + retone + chat context
│       └── types.ts            # TypeScript types (exact mirror of Pydantic models)
│
├── backend/
│   ├── app/
│   │   ├── config.py           # pydantic-settings, reads .env
│   │   ├── models.py           # Pydantic models (contract with frontend/lib/types.ts)
│   │   ├── scoring.py          # Deterministic 0-100 score from finding statuses/risks
│   │   ├── embeddings.py       # multilingual-e5-large, query:/passage: prefixes
│   │   ├── retriever.py        # Qdrant search with per-corpus balancing
│   │   ├── ingest.py           # PDF -> tagged chunks -> Qdrant (windowed chunker)
│   │   ├── llm.py              # Claude calls: analysis, streaming, retone, clarify, chat, title translation
│   │   ├── main.py             # FastAPI app, CORS, startup check, /health
│   │   └── routes/             # check, check_stream, retone, clarify, chat, extract, report_pdf
│   ├── data/regulations/       # PDFs (not in git)
│   └── tests/
│       ├── synthetic_products.json   # 20 test products
│       ├── eval_run.py               # Evaluation harness (manual faithfulness metrics)
│       └── eval_results.json         # Latest full-run results
│
├── start-demo.ps1              # One-shot boot with layer-by-layer health checks (Windows)
├── start-demo.sh                # Same, for macOS (opens Terminal.app windows via osascript)
├── .env.example
└── CLAUDE.md                   # Cross-machine agent coordination
```

---

## Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Embeddings | `multilingual-e5-large` (local) | Arabic+English bilingual; no data egress |
| Vector DB | Qdrant (self-hosted, compose-managed) | Data residency requirement |
| LLM | Claude Sonnet 4.6 analysis, Haiku 4.5 clarify/translate, `temperature=0` | Quality where it matters, speed where it does not |
| Structured output | `tool_use` (forced) | More reliable than parsing JSON from text |
| Citations | Server-side quote injection (LLM returns chunk indexes only) | Quote and source faithfulness 1.0 by construction |
| Scoring | Gated penalty formula in `scoring.py` (methodology v3) | Reproducible and explainable: 1:2:4 severity weights, needs-review at 50% expected value, and non-compensatory gates so a confirmed critical gap can never be offset into a "ready" rating. Full rationale in the module docstring |
| Tone/language switches | `/api/retone` rewrite of existing findings | Score and findings cannot change between renders |
| Frontend | Next.js 15, CSS logical properties | Full RTL/LTR without JS direction logic |

---

## Measured Quality (20-product eval, 2026-07-13, scoring methodology v3, full corpus)

| Metric | Result |
|--------|--------|
| Valid structured output | 20/20 |
| Source faithfulness | 1.000 (157/157 findings cite retrieved sources) |
| Quote faithfulness | 1.000 (157/157 verbatim quotes found in retrieved chunks) |
| Scan latency | avg 54.8s, P95 68.2s (plus streaming: first articles ~1s, first finding ~15s) |
| Indexed regulatory chunks | 9,505 across 4 corpora (current live corpus, 17 PDFs) |

Scores use gated deterministic scoring (v3): a confirmed high-severity gap caps the score at 57 (high risk), a confirmed medium gap caps it at 81, so a critical breach is never offset by strengths elsewhere. The synthetic eval set is intentionally gap-heavy and lands mostly in the high-risk band under these rules; the report explains every score with per-finding point impacts and a gate notice.
