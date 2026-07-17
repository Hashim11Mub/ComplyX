from functools import lru_cache
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, FieldCondition, Filter, MatchValue, VectorParams
from .config import settings
from .embeddings import embed_query

VECTOR_SIZE = 1024  # multilingual-e5-large output dimension

KNOWN_CORPORA = ["sama", "pdpl", "shariah", "cma"]


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


def _hit_to_dict(hit) -> dict:
    return {
        "score": hit.score,
        "regulation_name": hit.payload.get("regulation_name", ""),
        "corpus": hit.payload.get("corpus", ""),
        "regulator": hit.payload.get("regulator", ""),
        "chapter": hit.payload.get("chapter", ""),
        "section": hit.payload.get("section", ""),
        "article_number": hit.payload.get("article_number", ""),
        "article_title": hit.payload.get("article_title", ""),
        "text": hit.payload.get("text", ""),
        "corpus_version": hit.payload.get("corpus_version", ""),
    }


def _query(client: QdrantClient, vector: list[float], limit: int, corpus: str | None) -> list[dict]:
    flt = None
    if corpus:
        flt = Filter(must=[FieldCondition(key="corpus", match=MatchValue(value=corpus))])
    response = client.query_points(
        collection_name=settings.qdrant_collection,
        query=vector,
        query_filter=flt,
        limit=limit,
        with_payload=True,
    )
    return [_hit_to_dict(h) for h in response.points]


def _diversify(hits: list[dict], limit: int, max_per_article: int = 2) -> list[dict]:
    """Long articles are stored as several windowed chunks; keep at most
    max_per_article of them so retrieval covers more distinct articles."""
    counts: dict[tuple[str, str], int] = {}
    out: list[dict] = []
    for hit in hits:
        key = (hit["regulation_name"], hit["article_number"])
        if counts.get(key, 0) >= max_per_article:
            continue
        counts[key] = counts.get(key, 0) + 1
        out.append(hit)
        if len(out) >= limit:
            break
    return out


def search(query: str, limit: int = 8, corpora: list[str] | None = None) -> list[dict]:
    """Semantic search. When several corpora are selected, retrieval is
    balanced per corpus so the large SAMA corpus doesn't drown the others,
    then merged by score. corpora=None means "search all" (the documented
    default); corpora=[] means the caller explicitly selected zero corpora,
    which must NOT silently fall back to "all" (callers already treat an
    empty chunk list as "no matching regulations found")."""
    if corpora is not None and len(corpora) == 0:
        return []

    client = get_client()
    vector = embed_query(query)

    selected = [c for c in (corpora or []) if c in KNOWN_CORPORA]
    if not selected or set(selected) == set(KNOWN_CORPORA):
        return _diversify(_query(client, vector, limit * 3, None), limit)
    if len(selected) == 1:
        return _diversify(_query(client, vector, limit * 3, selected[0]), limit)

    per_corpus = max(3, limit // len(selected))
    merged: list[dict] = []
    for corpus in selected:
        merged.extend(_diversify(_query(client, vector, per_corpus * 3, corpus), per_corpus))
    merged.sort(key=lambda c: c["score"], reverse=True)
    return merged[:limit]


def verify_chunk_text(source: str, article: str, text: str) -> bool:
    """Defends POST /api/report-pdf against a client posting a fabricated
    ComplianceResult: confirms `text` is genuinely a contiguous substring of
    a real indexed chunk for that source/article. Legitimate findings always
    pass this, since clean_excerpt() only trims from the ends, so the stored
    quote is always a real substring of the original chunk text."""
    if not text.strip():
        return False
    client = get_client()
    flt = Filter(must=[
        FieldCondition(key="regulation_name", match=MatchValue(value=source)),
        FieldCondition(key="article_number", match=MatchValue(value=article)),
    ])
    # Long articles are split into many windowed continuation chunks that all
    # share the same source/article_number label (one document alone has
    # 3,201 chunks), so a small limit can miss the specific window a finding
    # actually quoted from. Filtered to one exact source+article, the match
    # set is small regardless, so a generous cap costs nothing in practice.
    points, _ = client.scroll(
        collection_name=settings.qdrant_collection,
        scroll_filter=flt,
        limit=200,
        with_payload=True,
    )
    return any(text in p.payload.get("text", "") for p in points)


def count_by_corpus() -> dict[str, int]:
    client = get_client()
    counts: dict[str, int] = {}
    for corpus in KNOWN_CORPORA:
        try:
            counts[corpus] = client.count(
                collection_name=settings.qdrant_collection,
                count_filter=Filter(must=[FieldCondition(key="corpus", match=MatchValue(value=corpus))]),
                exact=True,
            ).count
        except Exception:
            counts[corpus] = 0
    return counts


def count_indexed() -> int:
    client = get_client()
    try:
        return client.count(
            collection_name=settings.qdrant_collection,
            exact=True,
        ).count
    except Exception:
        return 0
