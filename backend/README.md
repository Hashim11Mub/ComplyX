# ComplyX Backend

FastAPI service powering the compliance analysis pipeline.

## Stack

- **FastAPI**: REST API (LLM routes are sync `def` so `/health` stays responsive during long calls)
- **Qdrant** (self-hosted, compose-managed): vector store for 9,505 regulatory chunks across 4 corpora
- **`multilingual-e5-large`**: local bilingual embeddings (Arabic + English)
- **Claude Sonnet 4.6**: compliance analysis, retone, and chat via forced `tool_use`
- **Claude Haiku 4.5**: clarification questions and Arabic title translation
- **LangSmith**: optional tracing (set `LANGCHAIN_API_KEY` in `.env`)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/check` | Full compliance scan, deterministic score, verbatim citations |
| `POST` | `/api/check/stream` | Same scan over SSE: `retrieved`, `retrieved_ar`, `finding`*, `complete` |
| `POST` | `/api/retone` | Re-render an existing report in a new tone/language (never re-classifies) |
| `POST` | `/api/clarify` | 0-4 structured clarification questions for missing details |
| `POST` | `/api/chat` | Session-aware regulatory Q&A (accepts report/session context) |
| `POST` | `/api/extract-text` | PDF/DOCX/TXT text extraction for uploaded product documents |
| `POST` | `/api/report-pdf` | Branded bilingual PDF report (Playwright Chromium) |
| `GET` | `/health` | Readiness, chunk counts per corpus, corpus version |

## Setup

See the root [README.md](../README.md) for full setup instructions including Qdrant, ingest, and environment variables.

## Running

```powershell
$env:PYTHONUTF8 = "1"
uvicorn app.main:app --port 8001 --host 0.0.0.0
```

## Evaluation

```powershell
$env:PYTHONUTF8 = "1"
python -m tests.eval_run --limit 2   # smoke test
python -m tests.eval_run             # full 20-product run (manual faithfulness metrics)
```
