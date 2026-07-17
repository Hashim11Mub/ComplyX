import io
import zipfile
from fastapi import APIRouter, HTTPException, UploadFile, File
import fitz  # PyMuPDF — already in requirements

router = APIRouter()

MAX_CHARS = 8_000
MAX_BYTES = 20 * 1024 * 1024  # 20 MB — matches the limit promised in the UI
MAX_DOCX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024  # guards against zip-bomb DOCX files
CHUNK_SIZE = 1024 * 1024
SUPPORTED = {"pdf", "docx", "doc", "txt"}


# Sync def on purpose (see routes/check.py for the same rule): this does
# blocking, CPU-bound PDF/DOCX parsing, so a sync route lets FastAPI run it
# in a threadpool instead of blocking the event loop (and therefore /health)
# for the duration of the parse.
@router.post("/extract-text")
def extract_text(file: UploadFile = File(...)):
    filename = file.filename or "upload"
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""

    if ext not in SUPPORTED:
        raise HTTPException(
            status_code=415,
            detail="Unsupported file type. Please upload a PDF, DOCX, or TXT file.",
        )

    # Read in bounded chunks and bail out as soon as the running total
    # exceeds the limit, instead of buffering an unbounded upload into
    # memory before ever checking its size.
    chunks = []
    total = 0
    while True:
        chunk = file.file.read(CHUNK_SIZE)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_BYTES:
            raise HTTPException(
                status_code=413,
                detail="File is too large. Maximum size is 20 MB.",
            )
        chunks.append(chunk)
    content = b"".join(chunks)
    text = ""

    if ext == "txt":
        text = content.decode("utf-8", errors="replace").strip()

    elif ext == "pdf":
        try:
            doc = fitz.open(stream=content, filetype="pdf")
            pages = [page.get_text() for page in doc]
            doc.close()
            text = "\n\n".join(p.strip() for p in pages if p.strip())
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Could not read PDF: {exc}") from exc

    elif ext in ("docx", "doc"):
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                uncompressed_total = sum(info.file_size for info in archive.infolist())
            if uncompressed_total > MAX_DOCX_UNCOMPRESSED_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail="File expands to an unreasonable size when decompressed.",
                )
            from docx import Document  # python-docx
            doc = Document(io.BytesIO(content))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            text = "\n".join(paragraphs)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Could not read DOCX: {exc}") from exc

    text = text.strip()
    if not text:
        raise HTTPException(
            status_code=422,
            detail="No text could be extracted from the file. Make sure it is not scanned or image-only.",
        )

    truncated = len(text) > MAX_CHARS
    return {
        "text": text[:MAX_CHARS],
        "filename": filename,
        "char_count": min(len(text), MAX_CHARS),
        "truncated": truncated,
    }
