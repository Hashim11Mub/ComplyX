import io
from fastapi import APIRouter, HTTPException, UploadFile, File
import fitz  # PyMuPDF — already in requirements

router = APIRouter()

MAX_CHARS = 8_000
SUPPORTED = {"pdf", "docx", "doc", "txt"}


@router.post("/extract-text")
async def extract_text(file: UploadFile = File(...)):
    filename = file.filename or "upload"
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""

    if ext not in SUPPORTED:
        raise HTTPException(
            status_code=415,
            detail="Unsupported file type. Please upload a PDF, DOCX, or TXT file.",
        )

    content = await file.read()
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
            from docx import Document  # python-docx
            doc = Document(io.BytesIO(content))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            text = "\n".join(paragraphs)
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
