# ComplyX (ضامن)

AI-powered regulatory compliance analysis for Saudi Arabian fintech products. Built for the **AMAD Hackathon 2026** (Alinma Bank × Tuwaiq Academy), Financial Regulations track.

Describe a financial product, and ComplyX checks it against KSA regulations in seconds — returning a scored compliance report with per-article gap analysis, executive summary, and actionable recommendations.

---

## What It Does

1. **Describe your product** — paste a description in Arabic or English (upload and voice modes also available in the UI)
2. **AI agent analyses it** — semantic search retrieves relevant regulatory articles from Qdrant, then Claude Sonnet 4.6 produces a structured compliance report via forced tool use
3. **Get a full report** — compliance score (0–100), risk level, per-finding gap analysis with recommendations, executive summary, and downloadable report
4. **Ask follow-up questions** — built-in chat assistant for regulatory clarifications

---

## Architecture

```
Browser (Next.js 15, Arabic RTL)
  │
  └─ /api/check  ──────────────────► FastAPI backend
  └─ /api/chat                          │
                                        ├─ Qdrant (self-hosted)
                                        │   └─ multilingual-e5-large embeddings
                                        │   └─ 618+ regulatory chunks
                                        │
                                        └─ Claude Sonnet 4.6
                                            └─ tool_use (structured output)
```

**Frontend:** Next.js 15, React 19, TypeScript, CSS logical properties (full RTL/LTR)  
**Backend:** FastAPI, Qdrant, `multilingual-e5-large` (local embeddings), Claude Sonnet 4.6  
**Tracing:** LangSmith  
**Evaluation:** RAGAS (Faithfulness) over 20 synthetic Saudi fintech products

---

## Regulation Sources

All PDFs live in `backend/data/regulations/` (not in git — large files, publicly available).

**SAMA (Saudi Central Bank)** — https://rulebook.sama.gov.sa  
8 PDFs covering: All Financial Institutions, Banking Sector, Credit Bureaus, Finance Sector, Laws & Implementing Regulations, Money Exchange Sector, Payment Systems & Payment Services Providers, Regulatory Sandbox

**SDAIA (Personal Data Protection)**  
- Personal Data Protection Law (PDPL)
- Implementing Regulation of the PDPL
- Regulation on Personal Data Transfer Outside the Kingdom

**AAOIFI**  
- Shariah Standards for Islamic finance products

---

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+
- Docker Desktop (for Qdrant)

### 1. Environment

Copy `.env.example` to `.env` and fill in:

```
ANTHROPIC_API_KEY=sk-ant-...
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION=sama_regulations

# Optional — enables LangSmith tracing
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=ls__...
LANGCHAIN_PROJECT=complyx-amad
```

### 2. Start Qdrant

```powershell
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

### 3. Ingest regulations

Place PDFs in `backend/data/regulations/`, then from `backend/`:

```powershell
pip install -r requirements.txt
python -m app.ingest --dir data/regulations
```

First run downloads `multilingual-e5-large` (~1.1 GB). Expected output: `Indexed 618+ chunks total`.

### 4. Start backend

```powershell
cd backend
uvicorn app.main:app --reload --port 8000 --host 0.0.0.0
```

Verify: `http://127.0.0.1:8000/health` → `{"status":"ok","indexed_articles":618,"ready":true}`

### 5. Start frontend

```powershell
cd frontend
npm install
$env:BACKEND_URL = "http://127.0.0.1:8000"
npm run dev
```

Open `http://localhost:3000`.

> **Windows note:** Set `BACKEND_URL` in the same PowerShell session as `npm run dev`. Do not use `http://localhost:8000` — use `127.0.0.1` to avoid IPv6 resolution issues.

---

## Running the Evaluation

Tests ComplyX against 20 synthetic Saudi fintech product descriptions, measuring latency and RAGAS Faithfulness using Claude Haiku as the judge LLM.

```powershell
# Install eval dependencies (once)
pip install ragas datasets

# Smoke test — first 2 products
cd backend
python -m tests.eval_run --limit 2

# Full 20-product run
python -m tests.eval_run

# Latency + coverage only, skip RAGAS
python -m tests.eval_run --no-ragas
```

Results are printed to the terminal and saved to `backend/tests/eval_results.json`. LangSmith traces appear at https://smith.langchain.com under the configured project.

---

## API Reference

### `POST /api/check`

Runs a full compliance scan.

```json
{
  "product_description": "string (min 20 chars)",
  "product_type": "payment_services | consumer_finance | open_banking | general | aml | pdpl",
  "tone": "simple | executive | technical",
  "lang": "ar | en"
}
```

Returns a `ComplianceResult` — see `backend/app/models.py` and `frontend/lib/types.ts` (kept in sync).

### `POST /api/chat`

Regulatory consultation chat with context from retrieved chunks.

```json
{
  "query": "string",
  "messages": [{ "role": "user | assistant", "content": "string" }]
}
```

### `GET /health`

Returns backend readiness and indexed article count.

---

## Project Structure

```
ComplyX/
├── frontend/                   # Next.js 15 app
│   ├── app/
│   │   ├── api/check/          # Proxy → FastAPI (falls back to mock if BACKEND_URL unset)
│   │   ├── api/chat/
│   │   └── globals.css
│   ├── components/
│   │   └── ComplianceChecker.tsx   # Main UI (all 3 steps + report)
│   └── lib/
│       ├── api.ts              # checkCompliance(), downloadReport()
│       └── types.ts            # TypeScript types (must match Pydantic models)
│
├── backend/
│   ├── app/
│   │   ├── config.py           # pydantic-settings, reads .env
│   │   ├── models.py           # Pydantic models
│   │   ├── embeddings.py       # multilingual-e5-large, query:/passage: prefixes
│   │   ├── retriever.py        # Qdrant semantic search
│   │   ├── ingest.py           # PDF → chunks → Qdrant
│   │   ├── llm.py              # Claude Sonnet 4.6, tool_use, LangSmith tracing
│   │   ├── main.py             # FastAPI app, CORS, startup health check
│   │   └── routes/
│   │       ├── check.py        # POST /api/check
│   │       └── chat.py         # POST /api/chat
│   ├── data/regulations/       # PDFs (not in git)
│   └── tests/
│       ├── synthetic_products.json   # 20 test products
│       └── eval_run.py               # RAGAS + LangSmith evaluation harness
│
├── .env.example
└── CLAUDE.md                   # Cross-machine agent coordination
```

---

## Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Embeddings | `multilingual-e5-large` (local) | Arabic+English bilingual; no data egress |
| Vector DB | Qdrant (self-hosted) | Data residency requirement |
| LLM | Claude Sonnet 4.6, `temperature=0` | Deterministic structured output |
| Structured output | `tool_use` (forced) | More reliable than parsing JSON from text |
| Frontend | Next.js 15, CSS logical properties | Full RTL/LTR without JS direction logic |

---

## Quality Targets

| Metric | Target |
|--------|--------|
| RAGAS Faithfulness | > 0.92 |
| Mean response latency | < 10s |
| Indexed regulatory chunks | 618+ |
