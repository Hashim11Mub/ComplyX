from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .routes.check import router as check_router
from .routes.check_stream import router as check_stream_router
from .routes.chat import router as chat_router
from .routes.clarify import router as clarify_router
from .routes.extract import router as extract_router
from .routes.report_pdf import router as report_pdf_router
from .routes.retone import router as retone_router
from .retriever import ensure_collection_exists, count_indexed, count_by_corpus

app = FastAPI(title="ComplyX API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", "http://127.0.0.1:3000",
        "http://localhost:3002", "http://127.0.0.1:3002",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.include_router(check_router, prefix="/api")
app.include_router(check_stream_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(clarify_router, prefix="/api")
app.include_router(extract_router, prefix="/api")
app.include_router(report_pdf_router, prefix="/api")
app.include_router(retone_router, prefix="/api")


def _disable_tracing() -> None:
    import os
    # Both spellings: current langsmith versions check LANGSMITH_TRACING
    # first, older ones LANGCHAIN_TRACING_V2.
    os.environ["LANGCHAIN_TRACING_V2"] = "false"
    os.environ["LANGSMITH_TRACING"] = "false"


async def _check_langsmith() -> None:
    """Validate the LangSmith key once at startup. A dead key otherwise fails
    silently per-trace in a background thread (or spams 403s), so: verify it,
    and if rejected, disable tracing for the run with one clear message.
    All prints in here are ASCII-only (non-cp1252 consoles crash on Unicode)."""
    if not (settings.langchain_tracing_v2 and settings.langchain_api_key):
        print("[startup] LangSmith tracing not configured (no key) - skipping")
        return
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                "https://api.smith.langchain.com/api/v1/sessions",
                params={"limit": 1},
                headers={"x-api-key": settings.langchain_api_key},
            )
        if resp.status_code == 200:
            print(f"[startup] LangSmith tracing active - project '{settings.langchain_project}'")
        else:
            _disable_tracing()
            print(
                f"[startup] LangSmith key REJECTED (HTTP {resp.status_code}) - tracing disabled for this run. "
                "Generate a fresh key at smith.langchain.com (Settings, API Keys) and update "
                "LANGCHAIN_API_KEY in .env"
            )
    except Exception as exc:
        _disable_tracing()
        print(f"[startup] LangSmith unreachable ({type(exc).__name__}) - tracing disabled for this run")


@app.on_event("startup")
async def startup():
    await _check_langsmith()
    ensure_collection_exists()
    n = count_indexed()
    print(f"[startup] Qdrant ready — {n} articles indexed")
    # Warm the embedding model off-thread so /health opens immediately but the
    # first scan doesn't pay the multi-second weight load (visible as the
    # "Loading weights" burst on the first request in every cold run).
    import threading
    from .embeddings import get_model
    threading.Thread(target=get_model, daemon=True, name="model-warmup").start()


@app.get("/health")
def health():
    indexed = count_indexed()
    return {
        "status": "ok",
        "indexed_articles": indexed,
        "ready": indexed > 0,
        "corpus_version": settings.corpus_version,
        "corpora": count_by_corpus(),
    }
