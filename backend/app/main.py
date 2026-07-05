from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .routes.check import router as check_router
from .routes.check_stream import router as check_stream_router
from .routes.chat import router as chat_router
from .routes.clarify import router as clarify_router
from .routes.extract import router as extract_router
from .routes.report_pdf import router as report_pdf_router
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


@app.on_event("startup")
async def startup():
    ensure_collection_exists()
    n = count_indexed()
    print(f"[startup] Qdrant ready — {n} articles indexed")


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
