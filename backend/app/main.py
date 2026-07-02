import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes.check import router as check_router
from .routes.chat import router as chat_router
from .routes.clarify import router as clarify_router
from .routes.extract import router as extract_router
from .retriever import ensure_collection_exists, count_indexed

app = FastAPI(title="ComplyX API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.include_router(check_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(clarify_router, prefix="/api")
app.include_router(extract_router, prefix="/api")


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
    }
