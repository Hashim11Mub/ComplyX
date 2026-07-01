from functools import lru_cache
from sentence_transformers import SentenceTransformer
from .config import settings

# multilingual-e5-large uses instruction prefixes:
# "query: " for search queries, "passage: " for documents
QUERY_PREFIX = "query: "
PASSAGE_PREFIX = "passage: "


@lru_cache(maxsize=1)
def get_model() -> SentenceTransformer:
    return SentenceTransformer(settings.embedding_model)


def embed_query(text: str) -> list[float]:
    model = get_model()
    vector = model.encode(QUERY_PREFIX + text, normalize_embeddings=True)
    return vector.tolist()


def embed_passages(texts: list[str]) -> list[list[float]]:
    model = get_model()
    prefixed = [PASSAGE_PREFIX + t for t in texts]
    vectors = model.encode(prefixed, normalize_embeddings=True, batch_size=32, show_progress_bar=True)
    return [v.tolist() for v in vectors]
