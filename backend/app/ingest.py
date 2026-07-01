"""
SAMA Regulation Ingestion Pipeline
===================================
Run as: python -m backend.app.ingest --dir backend/data/regulations

Place SAMA PDF files in backend/data/regulations/ before running.
Download from: https://rulebook.sama.gov.sa

Recommended files for Phase 0 (3-5 PDFs minimum):
  - Consumer Finance Regulation
  - Payment Services Regulation
  - Open Banking Framework
  - PDPL
  - AML Requirements
"""

import argparse
import re
import uuid
from pathlib import Path

import fitz  # PyMuPDF
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct

from .config import settings
from .embeddings import embed_passages
from .retriever import ensure_collection_exists, count_indexed

# ── Docling (optional — for scanned/complex PDFs only) ──────────────────────
try:
    from docling.document_converter import DocumentConverter as DoclingConverter
    DOCLING_AVAILABLE = True
except ImportError:
    DOCLING_AVAILABLE = False


# ── Text extraction ──────────────────────────────────────────────────────────

def extract_pages(pdf_path: Path) -> list[dict]:
    """Extract per-page text blocks using PyMuPDF."""
    doc = fitz.open(str(pdf_path))
    pages = []
    for page_num in range(len(doc)):
        text = doc[page_num].get_text("text").strip()
        if text:
            pages.append({"page": page_num + 1, "text": text})
    doc.close()
    return pages


def extract_pages_docling(pdf_path: Path) -> list[dict]:
    if not DOCLING_AVAILABLE:
        return extract_pages(pdf_path)
    converter = DoclingConverter()
    result = converter.convert(str(pdf_path))
    pages = []
    for i, page in enumerate(result.document.pages, 1):
        text = page.export_to_markdown().strip()
        if text:
            pages.append({"page": i, "text": text})
    return pages


# ── Article-level chunking ───────────────────────────────────────────────────

# Arabic: المادة الأولى / المادة 1 / المادة (1)
_AR_ARTICLE = re.compile(
    r"((?:ال)?مادة\s+"
    r"(?:الأولى|الثانية|الثالثة|الرابعة|الخامسة"
    r"|السادسة|السابعة|الثامنة|التاسعة|العاشرة"
    r"|\d+(?:\s*/\s*\d+)?|\(\s*\d+\s*\)))",
    re.UNICODE,
)
_AR_CHAPTER = re.compile(
    r"((?:الباب|الفصل|القسم|الفرع)\s+"
    r"(?:الأول|الثاني|الثالث|الرابع|الخامس|\d+)[^\n]*)",
    re.UNICODE,
)

# English: "Article 1", "Article 1:", "Article 1 -", "ARTICLE 1"
# Also handles "Rule 1", "Section 1", "1." numbered paragraphs
_EN_ARTICLE = re.compile(
    r"^((?:Article|Rule|Regulation|Clause|Section)\s+\d+(?:\.\d+)*[^\n]{0,80})",
    re.MULTILINE | re.IGNORECASE,
)
_EN_NUMBERED = re.compile(
    r"^(\d+\.\s+[A-Z][^\n]{10,80})",
    re.MULTILINE,
)
_EN_CHAPTER = re.compile(
    r"^((?:Chapter|Part|Title|Division)\s+(?:\d+|[IVX]+)[^\n]*)",
    re.MULTILINE | re.IGNORECASE,
)


def _sliding_window(
    pages: list[dict],
    regulation_name: str,
    pdf_name: str,
    chunk_chars: int = 900,
    overlap_chars: int = 120,
) -> list[dict]:
    """Last-resort chunker: fixed-size windows across all page text."""
    full = "\n\n".join(p["text"] for p in pages)
    chunks = []
    start = 0
    idx = 0
    while start < len(full):
        end = min(start + chunk_chars, len(full))
        # Don't split mid-word — walk back to last space
        if end < len(full):
            space = full.rfind(" ", start, end)
            if space > start:
                end = space
        text = full[start:end].strip()
        if len(text) > 80:
            chunks.append({
                "regulation_name": regulation_name,
                "regulation_filename": pdf_name,
                "chapter": "",
                "section": "",
                "article_number": f"chunk-{idx + 1}",
                "article_title": "",
                "text": text,
                "corpus_version": settings.corpus_version,
            })
        start = end - overlap_chars
        idx += 1
    return chunks


def _split_on_pattern(
    full_text: str,
    pattern: re.Pattern,
    regulation_name: str,
    pdf_name: str,
    current_chapter: str = "",
) -> list[dict]:
    """
    Split full_text on article-header pattern.
    Returns list of chunks or [] if pattern didn't match enough articles.
    """
    parts = pattern.split(full_text)
    if len(parts) < 5:  # fewer than 2 articles found — not useful
        return []

    chunks = []
    chapter = current_chapter
    i = 0
    while i < len(parts):
        part = parts[i].strip()
        if not part:
            i += 1
            continue
        if pattern.fullmatch(part) or (pattern.flags & re.MULTILINE and pattern.match(part)):
            article_number = part
            body = parts[i + 1].strip() if i + 1 < len(parts) else ""

            # Update chapter context from body prefix
            ch = _AR_CHAPTER.search(body[:200]) or _EN_CHAPTER.search(body[:200])
            if ch:
                chapter = ch.group(1).strip()

            lines = body.split("\n")
            article_title = lines[0].strip() if lines else ""
            # Cap chunk at 1500 chars to stay within embedding model limits
            chunk_text = f"{article_number}\n{body}"[:1500]

            if len(body) > 30:
                chunks.append({
                    "regulation_name": regulation_name,
                    "regulation_filename": pdf_name,
                    "chapter": chapter,
                    "section": "",
                    "article_number": article_number,
                    "article_title": article_title,
                    "text": chunk_text,
                    "corpus_version": settings.corpus_version,
                })
            i += 2
        else:
            ch = _AR_CHAPTER.search(part) or _EN_CHAPTER.search(part)
            if ch:
                chapter = ch.group(1).strip()
            i += 1

    return chunks


def chunk_into_articles(
    pages: list[dict], regulation_name: str, pdf_name: str
) -> list[dict]:
    """
    Strategy (in order):
    1. Arabic article markers
    2. English "Article N" markers
    3. English "N." numbered paragraph markers
    4. Sliding window (last resort)
    """
    # Join pages with double newline so paragraph boundaries are preserved
    full_text = "\n\n".join(p["text"] for p in pages)

    # 1 — Arabic
    chunks = _split_on_pattern(full_text, _AR_ARTICLE, regulation_name, pdf_name)
    if chunks:
        return chunks

    # 2 — English Article/Rule/Section
    chunks = _split_on_pattern(full_text, _EN_ARTICLE, regulation_name, pdf_name)
    if chunks:
        return chunks

    # 3 — English numbered paragraphs ("1. Capital requirements...")
    chunks = _split_on_pattern(full_text, _EN_NUMBERED, regulation_name, pdf_name)
    if chunks:
        return chunks

    # 4 — Sliding window fallback
    return _sliding_window(pages, regulation_name, pdf_name)


# ── Main ingestion ───────────────────────────────────────────────────────────

def ingest_pdf(pdf_path: Path, use_docling: bool = False) -> int:
    regulation_name = pdf_path.stem.replace("_", " ").replace("-", " ")
    print(f"\n📄 Processing: {pdf_path.name}")

    pages = extract_pages_docling(pdf_path) if use_docling else extract_pages(pdf_path)
    print(f"  Extracted {len(pages)} pages")

    chunks = chunk_into_articles(pages, regulation_name, pdf_path.name)
    strategy = "article" if chunks and "chunk-" not in chunks[0]["article_number"] else "sliding-window"
    print(f"  Chunked into {len(chunks)} segments [{strategy}]")

    if not chunks:
        print("  [skip] No usable content extracted")
        return 0

    texts = [c["text"] for c in chunks]
    print(f"  Embedding {len(texts)} chunks...")
    vectors = embed_passages(texts)

    client = QdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)
    points = [
        PointStruct(
            id=str(uuid.uuid5(
                uuid.NAMESPACE_URL,
                chunk["regulation_filename"] + chunk["article_number"] + chunk["text"][:50],
            )),
            vector=vector,
            payload=chunk,
        )
        for chunk, vector in zip(chunks, vectors)
    ]

    for i in range(0, len(points), 100):
        client.upsert(
            collection_name=settings.qdrant_collection,
            points=points[i : i + 100],
        )

    print(f"  ✅ Indexed {len(points)} chunks")
    return len(points)


def run(regulations_dir: str, use_docling: bool = False) -> None:
    pdf_dir = Path(regulations_dir)
    pdfs = list(pdf_dir.glob("*.pdf"))

    if not pdfs:
        print(f"\n⚠️  No PDF files found in {pdf_dir}")
        print("    Download SAMA regulations from: https://rulebook.sama.gov.sa")
        return

    print(f"\n{'='*60}")
    print(f"ComplyX — SAMA Regulation Ingestion")
    print(f"Collection : {settings.qdrant_collection}")
    print(f"Embedding  : {settings.embedding_model}")
    print(f"PDFs found : {len(pdfs)}")
    print(f"{'='*60}")

    ensure_collection_exists()

    total = 0
    for pdf_path in sorted(pdfs):
        total += ingest_pdf(pdf_path, use_docling=use_docling)

    print(f"\n{'='*60}")
    print(f"✅ Ingestion complete")
    print(f"   PDFs processed : {len(pdfs)}")
    print(f"   Chunks indexed : {total} (this run)")
    print(f"   Total in Qdrant: {count_indexed()}")
    print(f"   Corpus version : {settings.corpus_version}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest SAMA PDFs into Qdrant")
    parser.add_argument("--dir", default="backend/data/regulations")
    parser.add_argument("--docling", action="store_true")
    args = parser.parse_args()
    run(args.dir, use_docling=args.docling)
