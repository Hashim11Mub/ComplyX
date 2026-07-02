# ComplyX Backend

FastAPI service powering the compliance analysis pipeline.

## Stack

- **FastAPI** — REST API
- **Qdrant** (self-hosted) — vector store for regulatory chunks
- **`multilingual-e5-large`** — local bilingual embeddings (Arabic + English)
- **Claude Sonnet 4.6** — compliance analysis via `tool_use` forced structured output
- **LangSmith** — optional tracing (set `LANGCHAIN_API_KEY` in `.env`)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/check` | Full compliance scan — returns scored report with findings |
| `POST` | `/api/chat` | Regulatory Q&A chat with RAG context |
| `GET` | `/health` | Readiness check + indexed chunk count |

## Setup

See the root [README.md](../README.md) for full setup instructions including Qdrant, ingest, and environment variables.

## Running

```powershell
uvicorn app.main:app --reload --port 8000 --host 0.0.0.0
```

## Evaluation

```powershell
python -m tests.eval_run --limit 2   # smoke test
python -m tests.eval_run             # full 20-product RAGAS run
```
