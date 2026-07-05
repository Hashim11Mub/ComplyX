"""
ComplyX evaluation harness.

Usage (run from backend/ directory):
  # First install eval deps (once):
  pip install ragas datasets langsmith langchain-anthropic

  # Run on first 2 products (LangSmith smoke test):
  python -m tests.eval_run --limit 2

  # Run all 20:
  python -m tests.eval_run

  # Latency + coverage only, skip RAGAS:
  python -m tests.eval_run --no-ragas

Results are printed to stdout and saved to tests/eval_results.json.
LangSmith traces appear at https://smith.langchain.com under your configured project.
"""

import argparse
import json
import logging
import os
import sys
import time
import traceback
from pathlib import Path

# ---------------------------------------------------------------------------
# Bootstrap path so "python -m tests.eval_run" finds the app package.
# ---------------------------------------------------------------------------
sys.path.insert(0, str(Path(__file__).parent.parent))

# Silence noisy background loggers before anything else loads.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("langsmith").setLevel(logging.ERROR)

# Load .env early so LangSmith env vars are set before any module imports.
from dotenv import load_dotenv
_ENV_FILE = Path(__file__).parent.parent.parent / ".env"
load_dotenv(str(_ENV_FILE))

_ls_key = os.environ.get("LANGCHAIN_API_KEY", "")
if _ls_key:
    os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
    os.environ.setdefault("LANGCHAIN_PROJECT", os.environ.get("LANGCHAIN_PROJECT", "complyx-amad"))
    print(f"[langsmith] Tracing enabled → project '{os.environ['LANGCHAIN_PROJECT']}'")
else:
    print("[langsmith] LANGCHAIN_API_KEY not set — tracing disabled")

from app.retriever import search, count_indexed
from app.llm import analyze_compliance

PRODUCTS_FILE = Path(__file__).parent / "synthetic_products.json"
RESULTS_FILE = Path(__file__).parent / "eval_results.json"


def load_products(limit: int | None) -> list[dict]:
    if not PRODUCTS_FILE.exists():
        print(f"[error] {PRODUCTS_FILE} not found. Paste the synthetic products there first.")
        sys.exit(1)
    products = json.loads(PRODUCTS_FILE.read_text(encoding="utf-8"))
    if limit:
        products = products[:limit]
    return products


def run_single(product: dict) -> dict:
    pid = product["id"]
    product_type = product["product_type"]
    description = product["description"]
    lang = product.get("lang", "ar")

    t0 = time.perf_counter()
    chunks = search(description, limit=12)
    retrieve_ms = (time.perf_counter() - t0) * 1000

    t1 = time.perf_counter()
    result = analyze_compliance(
        product_description=description,
        product_type=product_type,  # type: ignore[arg-type]
        retrieved_chunks=chunks,
        tone="executive",
        lang=lang,
    )
    llm_ms = (time.perf_counter() - t1) * 1000
    total_ms = retrieve_ms + llm_ms

    return {
        "id": pid,
        "product_type": product_type,
        "lang": lang,
        "compliance_score": result.compliance_score,
        "risk_level": result.risk_level,
        "gaps_count": result.gaps_count,
        "findings_count": len(result.findings),
        "retrieve_ms": round(retrieve_ms, 1),
        "llm_ms": round(llm_ms, 1),
        "total_ms": round(total_ms, 1),
        # Private fields for faithfulness check (stripped from JSON output)
        "_retrieved_sources": list({c.get("regulation_name", "") for c in chunks}),
        "_finding_sources": [f.requirement.source for f in result.findings],
        "_retrieved_texts": [c.get("text", "") for c in chunks],
        "_finding_texts": [f.requirement.text for f in result.findings],
    }


def _norm(s: str) -> str:
    """Collapse all whitespace so verbatim comparison ignores line-wrap differences."""
    return " ".join(s.split())


def compute_faithfulness(rows: list[dict]) -> dict:
    """
    Two faithfulness metrics, both computed per finding:

    1. Source faithfulness — requirement.source matches one of the
       regulation_name values from the retrieved chunks (no invented sources).
    2. Quote faithfulness — requirement.text (the "verbatim" article text shown
       in the UI as Regulatory Basis) actually appears inside one of the
       retrieved chunk texts (whitespace-normalized substring match).
    """
    total_findings = 0
    grounded_findings = 0
    grounded_quotes = 0
    hallucinated: list[str] = []
    unfaithful_quotes: list[str] = []

    for r in rows:
        retrieved = set(r["_retrieved_sources"])
        chunk_texts = [_norm(t) for t in r.get("_retrieved_texts", [])]
        finding_texts = r.get("_finding_texts", [])
        for i, src in enumerate(r["_finding_sources"]):
            total_findings += 1
            if src in retrieved:
                grounded_findings += 1
            else:
                hallucinated.append(f"{r['id']}: '{src}'")

            quote = _norm(finding_texts[i]) if i < len(finding_texts) else ""
            if quote and any(quote in ct for ct in chunk_texts):
                grounded_quotes += 1
            else:
                preview = quote[:80] if quote else "(empty req_text)"
                unfaithful_quotes.append(f"{r['id']}: {preview}")

    if total_findings == 0:
        return {}

    result = {
        "source_faithfulness": round(grounded_findings / total_findings, 4),
        "quote_faithfulness": round(grounded_quotes / total_findings, 4),
        "grounded_findings": grounded_findings,
        "grounded_quotes": grounded_quotes,
        "total_findings": total_findings,
    }
    if hallucinated:
        result["hallucinated_sources"] = hallucinated
    if unfaithful_quotes:
        result["unfaithful_quotes"] = unfaithful_quotes
    return result


def print_table(rows: list[dict], ragas_scores: dict, indexed: int) -> None:
    print("\n" + "=" * 72)
    print("  ComplyX Evaluation Results")
    print("=" * 72)
    print(f"  Indexed chunks   : {indexed}")
    print(f"  Products tested  : {len(rows)}")
    print()

    header = f"  {'ID':<5} {'Type':<20} {'L':<3} {'Score':>5} {'Risk':<8} {'Gaps':>4} {'Total ms':>9}"
    print(header)
    print("  " + "-" * 66)
    for r in rows:
        print(
            f"  {r['id']:<5} {r['product_type']:<20} {r['lang']:<3} "
            f"{r['compliance_score']:>5} {r['risk_level']:<8} {r['gaps_count']:>4} "
            f"{r['total_ms']:>9.0f}"
        )

    total_ms_vals = [r["total_ms"] for r in rows]
    avg_ms = sum(total_ms_vals) / len(total_ms_vals)
    p95_idx = max(0, int(len(total_ms_vals) * 0.95) - 1)
    p95_ms = sorted(total_ms_vals)[p95_idx]

    print()
    print(f"  Avg latency      : {avg_ms / 1000:.1f}s")
    print(f"  P95 latency      : {p95_ms / 1000:.1f}s")

    if ragas_scores:
        sf = ragas_scores.get("source_faithfulness", "n/a")
        qf = ragas_scores.get("quote_faithfulness", "n/a")
        grounded = ragas_scores.get("grounded_findings", "?")
        gq = ragas_scores.get("grounded_quotes", "?")
        total = ragas_scores.get("total_findings", "?")
        print(f"  Source faithfulness    : {sf}  ({grounded}/{total} findings cite retrieved sources)")
        print(f"  Quote faithfulness     : {qf}  ({gq}/{total} verbatim quotes found in retrieved chunks)")
        if ragas_scores.get("hallucinated_sources"):
            print(f"  Hallucinated sources   : {ragas_scores['hallucinated_sources']}")
        if ragas_scores.get("unfaithful_quotes"):
            print(f"  Unfaithful quotes      : {len(ragas_scores['unfaithful_quotes'])} (see eval_results.json)")

    print("=" * 72 + "\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="Only run first N products")
    parser.add_argument("--no-ragas", action="store_true", help="Skip faithfulness check")
    args = parser.parse_args()

    indexed = count_indexed()
    print(f"[qdrant] {indexed} chunks indexed")
    if indexed == 0:
        print("[error] No chunks indexed. Run: python -m app.ingest --dir data/regulations")
        sys.exit(1)

    products = load_products(args.limit)
    print(f"[eval] Running {len(products)} product(s)...\n")

    rows: list[dict] = []
    for i, product in enumerate(products, 1):
        pid = product.get("id", f"p{i:02d}")
        ptype = product.get("product_type", "?")
        plang = product.get("lang", "ar")
        print(f"  [{i}/{len(products)}] {pid} ({ptype}, {plang}) ...", end=" ", flush=True)
        try:
            row = run_single(product)
            rows.append(row)
            print(f"score={row['compliance_score']}  gaps={row['gaps_count']}  {row['total_ms'] / 1000:.1f}s")
        except Exception as exc:
            print(f"FAILED")
            print(f"    Error: {exc}")
            traceback.print_exc()
            rows.append({"id": pid, "product_type": ptype, "lang": plang, "error": str(exc)})

    good_rows = [r for r in rows if "error" not in r]
    failed = len(rows) - len(good_rows)
    if failed:
        print(f"\n  [warn] {failed} product(s) failed (see errors above)")

    ragas_scores: dict = {}
    if not args.no_ragas and good_rows:
        print("\n[faithfulness] Computing source faithfulness across all findings...")
        ragas_scores = compute_faithfulness(good_rows)

    if good_rows:
        print_table(good_rows, ragas_scores, indexed)

    output = {
        "indexed_chunks": indexed,
        "products_tested": len(rows),
        "products_passed": len(good_rows),
        "products_failed": failed,
        "retrieval_limit": 12,
        "faithfulness": ragas_scores,
        "rows": [
            {k: v for k, v in r.items() if not k.startswith("_")}
            for r in rows
        ],
    }
    RESULTS_FILE.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[eval] Saved → {RESULTS_FILE}")


if __name__ == "__main__":
    main()
