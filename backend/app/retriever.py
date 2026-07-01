from functools import lru_cache
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams
from .config import settings
from .embeddings import embed_query

VECTOR_SIZE = 1024  # multilingual-e5-large output dimension


@lru_cache(maxsize=1)
def get_client() -> QdrantClient:
    return QdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)


def ensure_collection_exists() -> None:
    client = get_client()
    existing = {c.name for c in client.get_collections().collections}
    if settings.qdrant_collection not in existing:
        client.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )


def search(query: str, limit: int = 8) -> list[dict]:
    client = get_client()
    query_vector = embed_query(query)
    # qdrant-client 2.x uses query_points(); search() was removed
    response = client.query_points(
        collection_name=settings.qdrant_collection,
        query=query_vector,
        limit=limit,
        with_payload=True,
    )
    return [
        {
            "score": hit.score,
            "regulation_name": hit.payload.get("regulation_name", ""),
            "chapter": hit.payload.get("chapter", ""),
            "section": hit.payload.get("section", ""),
            "article_number": hit.payload.get("article_number", ""),
            "article_title": hit.payload.get("article_title", ""),
            "text": hit.payload.get("text", ""),
            "corpus_version": hit.payload.get("corpus_version", ""),
        }
        for hit in response.points
    ]


def count_indexed() -> int:
    client = get_client()
    try:
        return client.count(
            collection_name=settings.qdrant_collection,
            exact=True,
        ).count
    except Exception:
        return 0
