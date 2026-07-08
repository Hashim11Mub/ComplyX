# ComplyX — Claude Code Context

**Project:** ضامن (ComplyX) — SAMA Compliance AI Agent for AMAD Hackathon 2026  
**Organized by:** Alinma Bank (الإنماء) + Tuwaiq Academy  
**Track:** Financial Regulations

## Two-Tier Coordination System

**This file (CLAUDE.md)** is the cross-machine coordination layer. It lives inside the git repo and is the single source of truth for all Claude instances regardless of which machine they run on. Any progress, decisions, or plan changes that need to be visible to another machine MUST be written here and committed before the session ends.

**The `agent/` folder** at `../../agent/` (i.e. `<repo-root>/../agent/` — outside the git repo) is the local-machine layer. It is NOT in git and NOT visible to other machines. It tracks session-local state for Claude instances running on THIS machine only — continuity between sessions on the same box.

> **Rule:** If another teammate or another machine needs to know it → write it in CLAUDE.md and commit.  
> If it's only for your next session on the same machine → write it in `../../agent/HANDOFF.md`.

## Read This First

Before touching any code:
1. Read the **Current State**, **Phase Plan**, and **Locked Decisions** sections below — these are the cross-machine shared state.
2. Then check `../../agent/HANDOFF.md` — local notes from the last session on THIS machine (may not exist if this is a new machine or first session).

## What This Repo Is

A SAMA (Saudi Central Bank) compliance AI agent. Users paste a financial product description, the system checks it against SAMA regulations and Shariah standards via RAG + LangGraph, and returns a cited compliance report with gap analysis.

## ⚠️ Ports

ComplyX runs on non-default ports (chosen to avoid the common 3000/8000 conflicts with other local
projects). If these are free on your machine you can still use them; if not, ports are configurable via
`$BackendPort`/`$FrontendPort` in `start-demo.ps1`:
- **Backend: 8001** (`uvicorn app.main:app --port 8001 --host 0.0.0.0`)
- **Frontend: 3002** (`PORT=3002 npm run dev`; `frontend/.env.local` sets both `BACKEND_URL=http://127.0.0.1:8001` and `PORT=3002`)
- Qdrant: 6333 via `docker compose up -d qdrant` (named volume `complyx_qdrant_storage` — data survives container removal; do NOT use a bare `docker run`)
- One-shot boot: `./start-demo.ps1` (checks every layer, fails loudly)

## Current State (as of 2026-07-08 — update this section + commit when a phase changes)

**2026-07-08 update (stable retone + interview attribution + input merge + UI polish):**
- **`POST /api/retone`** (`backend/app/routes/retone.py`, `llm.py::retone_findings`, `frontend/app/api/retone/route.ts`, `api.ts::retoneReport`): tone/language switches in the report re-render ONLY the presentation text (title/keywords/analysis/recommendation/summary) from the existing findings. The retone tool schema has no status/risk fields and the backend copies both from the original findings, so the compliance score is identical by construction across tone/lang switches (verified: executive vs simple, same findings, same score). `handleComplexityChange`/`handleLangChange` call `retoneReport()`, NOT `checkCompliance()`.
- **Interview attribution** (`Finding.user_answer_ref` in `models.py` + `types.ts` — contract change, both updated together): when a finding's status/risk relies on an answer from the clarification interview, the LLM copies that answer into `user_answer_ref`; the UI shows a gold "Based on your interview answer: …" note in the expanded finding. Retone preserves the field verbatim (verified end-to-end).
- **Clarify recap:** the step 1.5 section stays mounted after the scan (read-only, chips disabled, actions hidden) whenever the user answered at least one question. `startScan()` now resets `clarifiedCount` (stale-chip fix).
- **Input modes merged:** `Mode = "describe" | "voice"` — upload is now an attach button/chip inside the describe panel (`.cx-attach-row`). `effectiveDesc()` combines typed text + extracted document text with an "[Attached document content]" separator. Submitted-product strip shows the attached file name and whitespace-collapses the description; product fallback label is "General financial product" (was "Unspecified product").
- **Voice fix:** `.cx-mic-pulse` overlays had no `pointer-events: none` and swallowed the stop-recording click.
- **Hero/UI:** eyebrow tag removed; subtitle is "Describe your product or upload its document…" (voice mention removed, AR+EN); `html[lang="ar"] .cx-hero-title` line-height 1.55 (Cairo overlap fix); shield glow ellipse resized + `overflow: visible` (was clipped at bottom/sides); traits are now Instant matching / **Verbatim article citations** / **Full regulatory coverage** (brighter cards rgba .13); teal gradient active states on mode buttons, product cards (white icons), complexity toggle; analysis-step journey card is now a white surface with scoped child overrides.

**⚠ Copy rule (user-set, 2026-07-08): never use the em dash character (—) in any user-visible copy or LLM-generated text, in either language. Use a comma, colon, or period instead. The compliance/retone/chat prompts all carry an explicit no-em-dash instruction; keep it when editing them.**

**2026-07-08 update 2 (session-aware assistant + trust/i18n fixes):**
- **Session-aware chat:** `ChatSessionContext`/`ChatFindingBrief` in `models.py` + `types.ts` (contract change, both updated together). The frontend sends product description, uploaded file name, interview answers, and the full report brief with every chat message (`buildChatContext()` in ComplianceChecker); `routes/chat.py::_session_block` renders it into the consultant's system prompt. Verified live: assistant answers "why did my product score low" citing the actual score/findings/license answer.
- **Event-loop fix (was "Backend offline" during re-fetches):** `check`, `retone`, `chat`, `clarify` routes were `async def` running blocking LLM calls on the event loop, starving `/health`. All four are now sync `def` (FastAPI threadpool). Verified: /health answers in ~240ms during a running retone. Keep new LLM routes sync.
- **Report variant cache + prefetch:** frontend caches report variants keyed `lang-complexity` (`resultCacheRef`/`inflightRef`/`baseResultRef`); every retone derives from the BASE scan findings, so each variant is generated once and repeated switches always show identical wording. After a scan the other language, then the two other detail levels, prefetch in the background (3 best-effort retones). Cache hit = instant switch; miss/in-flight = normal loading bar. Cleared on new scan/reset.
- **Executive summary can no longer vanish:** `RetoneRequest.executive_summary` carries the original; the retone prompt rewrites it (not invents), and both backend and frontend fall back to the original if the rewrite omits it.
- **Step 1.5 reliability:** if `/api/clarify` returns 0 questions but the coverage checklist shows uncovered dimensions, the frontend asks its own `FALLBACK_CLARIFY` questions (bilingual, one per coverage dim, max 4) so the UI never promises follow-ups and skips them. Clarify shell now animates (revealUp) like other steps; selected chips use the teal gradient and stay green in the recap.
- **Arabic display:** `retrieved_ar` SSE event (Haiku `translate_titles_ar`, emitted between `retrieved` and first `finding`, silently skipped on failure) swaps analysis-slot titles to Arabic; compliance prompt now hard-requires Arabic finding titles in Arabic sessions; `articleLabel()` localizes "Article/Section/Rule/Chapter" prefixes; verbatim excerpts stay English (quote-faithfulness anchor) with an Arabic caption explaining that, and `cleanExcerpt()` trims mid-sentence chunk boundaries for display only.
- **Analysis honesty:** stream keeps all retrieved articles (12); slots show top 8 plus a count line "N relevant articles in analysis, showing the 8 most decision-critical".
- **Report UX:** expanding a finding pans the scroll container to it after the expand animation (`#finding-<idx>` + scrollToId).

**Frontend — v2 (streaming + multi-regulator, verified end-to-end in browser 2026-07-04).**
Located in `frontend/`. Next.js 15, Arabic RTL. New in v2:
- **Streaming scan (F-1):** `runActualScan()` uses `streamCheck()` (lib/api.ts) against `/api/check-stream`; slots fill with real retrieved article titles (~1s warm), then live findings as Claude writes them; any stream error falls back to plain `checkCompliance()`. Slot priority: final findings → streamed findings → retrieved titles → shimmer.
- **Regulator scope chips (F-3):** `CORPUS_DEFS` chips above Product Type (SAMA/PDPL/Shariah/CMA); a chip disables itself when /health reports 0 chunks for that corpus; at least one always selected; per-finding regulator pill (`.cx-reg-tag`).
- **Live health badge (A-2):** topbar pill polls `/api/health` every 30s → "KSA Regs · Live · N" or red "Backend offline".
- **Honest report meta (I-7):** "Session reference" + "Scan date" + "Checked against N indexed articles · Corpus vX" (no more fictional auto-archive), plus the "Includes N clarified details" chip (Enh-7).
- **PDF export (F-2):** primary button → `/api/report-pdf` (bilingual PDF); falls back to the plain-text export on failure.
- **Deleted dead code (A-12):** ComplianceReport.tsx, ChatConsultation.tsx, AgentSteps.tsx, lib/mockCompliance.ts, app/api/report stub, api.ts downloadReport.
- `frontend/components/ComplianceChecker.tsx` — main UI; fully connected to real API. All input modes live (describe, upload, voice — voice errors go to a separate `voiceError` state, never into the transcript). Clarification interview intercepts scan. Language switch triggers full re-fetch (toggle disabled while re-fetching). **Floating chat drawer is wired to the real `/api/chat`** via `askConsultant()` (canned replies removed). **Honest scan state:** journey steps 1–3 animate on timers; step 4 stays active with rotating status text + elapsed seconds until the real API result arrives, then `finishScan()` runs (no `apiResultRef`/`animationFinishedRef` race anymore). 2.5s hold on scan view so user reads regulation titles before report appears. Slot count is dynamic. Finding titles/verbatim quotes use `dir="auto"`. Finding React keys are `id-idx` (LLM slugs can collide).
- `frontend/components/AgentSteps.tsx` — live step visualization
- `frontend/components/ChatConsultation.tsx` — **dead code, not imported** (the drawer in ComplianceChecker is the live chat)
- `frontend/components/ComplianceReport.tsx` — **dead code, not imported anywhere** — all report rendering is inline in ComplianceChecker.tsx. Can be deleted.
- `frontend/lib/types.ts` — TypeScript types **your Pydantic models must match exactly**. Includes `AppState` (`"input" | "clarifying" | "scanning" | "results"`), `ClarifyQuestion`, `ClarifyOption`, `ClarifyResponse`.
- `frontend/lib/api.ts` — `checkCompliance(desc, productType, tone, lang)` + `getProductQuestions(desc, productType, lang)` + `askConsultant(query, messages)` — real API calls
- `frontend/app/api/check/route.ts` — proxies to FastAPI; **NO mock fallback** — returns 503/502 with a clear error if backend missing/unreachable (mock fallback removed 2026-07-03; a dead backend must fail loudly, never fake results)
- `frontend/app/api/chat/route.ts` — proxies to FastAPI; NO mock fallback (same policy); 60s timeout
- `frontend/app/api/clarify/route.ts` — proxies to FastAPI; falls back to `{questions:[]}` if backend unreachable (clarification is optional by design)
- `frontend/app/api/extract-text/route.ts` — proxies multipart FormData to FastAPI; 503 if backend not configured
- `frontend/.env.local` — UTF-8, sets `BACKEND_URL=http://127.0.0.1:8001` (the old UTF-16 file Node couldn't read was fixed 2026-07-03; `$env:BACKEND_URL` shell step no longer required)

**Backend — v2 (audit remediation build, 2026-07-04).**
Located in `backend/app/`.
- `config.py` — pydantic-settings, reads `.env` via absolute path (critical — see HANDOFF)
- `models.py` — `CheckRequest` (+`corpora: list[str]|None`), `Requirement` (+`regulator`), `ComplianceResult`, clarify models
- `scoring.py` — **deterministic score** (I-5): 100 − penalties per finding (gap: −16/−10/−6 by risk; needs_review: −8/−5/−3), clamp [5,100]; risk thresholds 82/58. The LLM never emits a score.
- `embeddings.py` — multilingual-e5-large, `query:` / `passage:` prefixes
- `retriever.py` — Qdrant `query_points()` + **corpus filters**; multi-corpus requests are balanced per corpus then merged by score; `count_by_corpus()` feeds /health
- `ingest.py` — PDF → chunks → Qdrant; tags every chunk with `corpus`/`regulator` by filename (`corpus_for_filename`); long articles become windowed continuation chunks (no more 1,500-char truncation — Banking rulebook went 118 → 3,201 chunks)
- `llm.py` — **v2 core.** Sonnet 4.6 for analysis/chat, **Haiku 4.5 for clarify**. `COMPLIANCE_TOOL` v2 is chunk-index based (A-1): the LLM returns `chunk` (index into the retrieved context) + title/keywords/status/risk/analysis/recommendation; the backend injects verbatim text, source, article and regulator from the actual chunk — quote and source faithfulness are 1.0 by construction, no scores/quotes in the output schema (≈40% fewer output tokens, max_tokens now 4096). Static system prompt + tools carry `cache_control`; the retrieved-context block carries a second breakpoint so tone/lang re-fetches hit the prompt cache (volatile lang/tone instructions live at the END of the user message). `analyze_compliance_stream()` streams findings incrementally via fine-grained tool streaming (`eager_input_streaming` + `_FindingsScanner` partial-JSON parser). Chat answers in the question's language, plain text only.
- `main.py` — FastAPI app, CORS (3000+3002), registers check/check_stream/chat/clarify/extract/report_pdf; /health returns `corpus_version` + per-corpus counts
- `routes/check.py` — POST /api/check (retrieval limit 12, corpora filter)
- `routes/check_stream.py` — POST /api/check/stream — SSE: `retrieved` → `finding`* → `complete` (or `error`; client falls back to /api/check)
- `routes/report_pdf.py` — POST /api/report-pdf — bilingual branded PDF (Playwright Chromium; returns 501 with install hint if Playwright missing)
- `routes/chat.py` — POST /api/chat
- `routes/clarify.py` — POST /api/clarify; returns `{questions:[]}` for short descriptions; 0–4 structured multiple-choice questions
- `routes/extract.py` — POST /api/extract-text; supports PDF (PyMuPDF), DOCX (python-docx), TXT; max 8,000 chars with truncation flag; rejects files over 20 MB with 413 (matches the UI's promise)

**New deps in requirements.txt:** `python-multipart>=0.0.9`, `python-docx>=1.1.0`
Run `pip install python-multipart python-docx` after pulling on any machine.

**Eval Harness.**
- `backend/tests/eval_run.py` — 20-product evaluation harness with manual source faithfulness metric (replaced RAGAS — incompatible with Anthropic). Stores `_retrieved_sources` and `_finding_sources` per product for faithfulness calculation.
- `backend/tests/synthetic_products.json` — 20 synthetic Arabic/English products across 4 types
- `backend/tests/eval_results.json` — results from completed 20-product run

**Eval Results (20/20 passed, retrieval limit=8, 2026-07-02):**
- Avg latency: 76.5s | P95: ~100s (inherent to Claude API; frame as dev env without GPU/caching)
- Source faithfulness: not computed in stored results (the `_retrieved_sources` private fields were stripped before saving)
- Notable: p08 score=28/high, p11 score=18/high — appropriately low for non-compliant products; p01–p07 cluster around 62/medium

**Qdrant state (2026-07-04):** **9,108 chunks from 13 PDFs** — sama 5,432 · shariah 3,334 · cma 212 · pdpl 130 (corpus 2026-07, fixed windowing chunker). Local to each machine — run ingest per machine (see setup below); expect ~2–4h of CPU embedding for the full corpus.

**NOT YET DONE (post-hackathon):**
- LangGraph multi-tool agent (Phase 1) — the streaming pipeline covers the demo story; revisit later
- PostgreSQL audit log (Phase 2)
- Arabic-edition rulebooks (for Arabic-native verbatim quotes; current corpus is English)

## New Team Member / New Machine Setup

**Prerequisites:** Python 3.12, Node.js 18+, Docker Desktop

**Step 1 — Create `.env`** in `Application/ComplyX/` (copy from `.env.example`):
```
ANTHROPIC_API_KEY=sk-ant-...
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION=sama_regulations
```

**Step 2 — Get SAMA PDFs** — obtain the 8 PDFs from your teammate and place them in `backend/data/regulations/`. They are not in the repo (large files, public documents). Download from https://rulebook.sama.gov.sa if needed.

**Step 3 — Start Qdrant (named volume — do NOT use bare docker run):**
```powershell
docker compose up -d qdrant
```

**Step 4 — Install Python deps and run ingest** (from `backend/`):
```powershell
pip install -r requirements.txt
python -m app.ingest --dir data/regulations
```
First run downloads the multilingual-e5-large model (~1.1GB). Embedding the full 13-PDF corpus takes ~2–4h on CPU. Watch for `Total in Qdrant: 9108` (±small drift from window-dedup) at the end.

**Step 5 — Start backend** (from `backend/`; port 8001 — see Ports section above):
```powershell
$env:PYTHONUTF8 = "1"
uvicorn app.main:app --port 8001 --host 0.0.0.0
```
Verify: `http://127.0.0.1:8001/health` → `{"status":"ok","indexed_articles":<N>,"ready":true,"corpus_version":"2026-07","corpora":{...}}`

**Step 6 — Start frontend** (from `frontend/`):
```powershell
npm install
npm run dev
```
`frontend/.env.local` (UTF-8) already sets `BACKEND_URL=http://127.0.0.1:8001` and `PORT=3002`. Open `http://localhost:3002`

**Or do steps 3–6 in one shot:** `./start-demo.ps1` from the repo root.

**Windows-specific gotchas (read before debugging):**
- Use `--host 0.0.0.0` for uvicorn — Windows resolves `localhost` to IPv6 `::1` but uvicorn binds IPv4 only
- Use `http://127.0.0.1:8001` not `http://localhost:8001` for BACKEND_URL — same reason
- If you hand-edit `frontend/.env.local` yourself, don't use PowerShell's `echo > .env.local` — it writes UTF-16, which Node.js can't read. Use `[System.IO.File]::WriteAllText(...)` with a UTF-8 encoding (see `start-demo.ps1` for the exact call), or edit the existing file with a normal text editor.
- There is no mock fallback anywhere in this app anymore — if the backend is unreachable, `/api/check` and `/api/chat` return a 502/503 error instead of fake data. If you see an error banner in the UI, the backend is actually down; check its terminal.

## Phase Plan

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 0A | Frontend (Next.js RTL, all components) | ✅ Complete |
| 0B | Backend skeleton (FastAPI, Qdrant, single Claude call) | ✅ Complete |
| B | Frontend connected to real backend; bilingual; UI fixes; eval harness | ✅ Complete (2026-07-02) |
| C | Clarification interview; upload/voice input; language switch fix; traceable findings | ✅ Complete (2026-07-03) |
| D | Full audit remediation: A-1 quote injection, deterministic scoring, prompt caching, Haiku clarify, honest UI claims, health badge, dead-code cleanup | ✅ Complete (2026-07-04) |
| F-1 | **Streaming scan** — SSE, retrieved articles fill slots in ~1s, findings appear as Claude writes them, fallback to plain POST | ✅ Complete (2026-07-04) |
| F-2 | **PDF Remediation Roadmap** — bilingual branded PDF via Playwright Chromium (prioritized fix-plan table + full findings) | ✅ Complete (2026-07-04) |
| F-3 | **Multi-regulator scan** — SAMA + PDPL + AAOIFI Shariah + CMA corpora, scope chips, balanced retrieval, per-finding regulator tags | ✅ Complete (2026-07-04) |
| 1 | LangGraph multi-tool agent | ⬜ Superseded in spirit by the streaming pipeline; revisit post-hackathon |
| 2 | PostgreSQL audit log | ⬜ Deferred |

**Status:** Post-audit build. All three green-lit features shipped; corpus re-ingested with regulator tags and the fixed chunker (13 PDFs).

## Locked Decisions

Do not re-derive or debate these. They are set.

- **Embeddings:** `multilingual-e5-large` with `query:` / `passage:` prefixes — chosen for Arabic+English bilingual support, runs locally (no data egress)
- **Vector DB:** Qdrant self-hosted — data residency requirement; Pinecone is explicitly rejected
- **LLM:** Claude Sonnet 4.6, `temperature=0`, `tool_use` forced for structured output — not OpenAI (data egress), not text-parsed JSON (unreliable)
- **PDF parsing:** PyMuPDF — no LlamaIndex (unnecessary abstraction)
- **Auth:** FastAPI JWT — no Keycloak (rejected, too heavy for hackathon)
- **Frontend:** Not to be rebuilt. Next.js 15, Arabic RTL. Done.
- **Pydantic ↔ TypeScript contract:** `backend/app/models.py` must exactly match `frontend/lib/types.ts`. Change both together or neither.

## Architecture (locked)

```
User → Next.js frontend
       ↓ /api/check (proxied to FastAPI)
FastAPI backend
  ↓
LangGraph agent (Phase 1 — not yet built):
  Tool 1: regulation_retriever → Qdrant semantic search
  Tool 2: requirement_extractor → Claude Sonnet 4.6
  Tool 3: gap_checker → Claude Sonnet 4.6
  Tool 4: report_generator → Claude Sonnet 4.6
  ↓
PostgreSQL audit log (Phase 2)
```

Current Phase 0B: single Claude call replaces the full LangGraph agent. Works end-to-end.

**Stack:** Claude Sonnet 4.6 | LangGraph (Phase 1) | Qdrant (self-hosted) | multilingual-e5-large | PyMuPDF | FastAPI | PostgreSQL (Phase 2) | WeasyPrint PDF (Phase 2) | LangSmith tracing

## Critical Constraint

**The `/api/check` response JSON must exactly match `frontend/lib/types.ts`.**
Read `types.ts` before changing any Pydantic model. A mismatch breaks the UI silently.

## `llm.py` Implementation Notes

- System prompt injects exact `regulation_name` values from retrieved chunks — Claude must use these verbatim for `req_source`, preventing translation/paraphrasing between runs
- System prompt restricts Claude to only cite articles present in the retrieved context — prevents hallucinated findings from training knowledge
- `generate_clarification_questions()` uses `CLARIFY_TOOL` (tool_use forced), returns 0–4 questions targeting 7 compliance-critical dimensions; returns `ClarifyResponse(questions=[])` on any error — clarification is optional, scan always proceeds
- `req_text` in `COMPLIANCE_TOOL` is "exact article text from the regulation" — Claude copies it from the retrieved chunk context at temperature=0; this is surfaced in the UI as the "Regulatory Basis" verbatim quote for traceability

## Input Modes

- **Describe:** plain text, `inputText` state → `effectiveDesc()`
- **Upload:** `onFileChange()` extracts text — TXT via `file.text()` client-side; PDF/DOCX via POST `/api/extract-text` → FastAPI → PyMuPDF/python-docx; result stored in `uploadExtractedText` state → `effectiveDesc()`
- **Voice:** Web Speech API (`window.SpeechRecognition` / `window.webkitSpeechRecognition`), `recognition.lang = isAr ? "ar-SA" : "en-US"`, continuous + interim results; stored in `transcript` state → `effectiveDesc()`

## Clarification Interview Flow

`startScan()` → POST `/api/clarify` → 0 questions? → `runActualScan(effectiveDesc())` directly  
→ 1–4 questions? → `AppState = "clarifying"` → user answers chips → `submitClarifications()` → `buildAugmentedDescription()` appends answers to description → `runActualScan(augmented)`  
`submittedDesc` stores the augmented description so complexity/language re-fetches use identical input.

## README Rule (user-set, 2026-07-08)

At the END of a session, if the session changed anything user-facing (features, setup steps, ports, API surface, endpoints, corpus contents, measured quality numbers), update `README.md` (and `backend/README.md` if backend endpoints changed) to match, and include them in the git command list. Internal-only refactors do not require a README update. The no-em-dash copy rule applies to READMEs too.

## Git Rules (IMPORTANT)

**Do not run git commands yourself.** At the end of your session, write down the git commands the user needs to run manually. Format:

```
## Git commands to run after this session:
git add <specific files>
git commit -m "feat: description"
git push
```

Never `git add .` or `git add -A` — always be specific about which files to stage.
Never commit `.env`, `backend/data/regulations/*.pdf`, or `frontend/.env.local`.

## Regulation Data Sources

All PDFs live in `backend/data/regulations/` (not in git — large files). After adding new PDFs, re-run `python -m app.ingest --dir data/regulations` to re-index.

**SAMA (Saudi Central Bank)** — https://rulebook.sama.gov.sa (English PDFs, publicly available)
8 PDFs indexed (5,432 chunks, corpus tag `sama`):
- `All_Financial_Institutions_SAMA_Rulebook.pdf`
- `Banking_Sector_SAMA_Rulebook.pdf`
- `Credit_Bureaus_SAMA_Rulebook.pdf`
- `Finance_Sector_SAMA_Rulebook.pdf`
- `Laws_and_Implementing_SAMA_Rulebook.pdf`
- `Money_Exchange_Sector_SAMA_Rulebook.pdf`
- `Payment_Systems_and_Payment_Services_Providers_SAMA_Rulebook.pdf`
- `Regulatory_Sandbox_SAMA_Rulebook.pdf`

**SDAIA (Personal Data Protection)** — https://sdaia.gov.sa — 3 PDFs indexed (130 chunks, corpus tag `pdpl`):
- `PersonalDataProtectionLaw.pdf`, `ImplementingRegulationPersonalDataProtectionLaw.pdf`, `RegulationonPersonalData.pdf`

**AAOIFI (Shariah Standards)** — 1 PDF indexed (3,334 chunks, corpus tag `shariah`):
- `Shariaa-Standards-ENG.pdf`

**CMA (Capital Market Authority)** — 1 PDF indexed (212 chunks, corpus tag `cma`):
- `CapitalMarketInstitutionsRegulations.pdf`

Corpus tags are inferred from filenames in `ingest.py::corpus_for_filename` — new PDFs whose names don't match any rule land in corpus `other` (never silently attributed to SAMA).

**After adding new PDFs:** Re-run ingest. The chunk count will increase. Update the startup health check expected count in `backend/app/main.py` if you hardcoded it anywhere.

## Quality Targets

**Measured (20-product eval, 2026-07-04, v2 pipeline, limit=12, full 9,108-chunk corpus):**
- 20/20 valid structured output (0 failures)
- **Source faithfulness: 1.000** (159/159) — by construction (backend injects sources from retrieved chunks)
- **Quote faithfulness: 1.000** (159/159; was **0.432** before A-1) — by construction; this is the before/after
  story for the "data analysis" judging axis
- Latency: **avg 56.7s, P95 70.1s** (was 82.6s / 105.8s) — plus streaming: retrieved articles on screen ~1s,
  first finding ~15s (perceived latency)
- Scores: deterministic, spread 5–66 with no clustering (was 12/20 at exactly 62). NOTE: the current penalty
  weights in `scoring.py` are strict — needs_review-heavy products land in "high risk" often. If calibration
  feels harsh in demos, tune `_PENALTY` in ONE place (e.g. needs_review 8/5/3 → 5/3/2) — no prompt changes needed.

**Eval harness notes:**
- Run from `backend/`: `$env:PYTHONUTF8="1"; python -m tests.eval_run` (UTF-8 flag required on Windows consoles)
- Results persist to `tests/eval_results.json` under the `faithfulness` key (both metrics + per-finding
  unfaithful-quote list). RAGAS is NOT used and will NOT work — it hardcodes OpenAI's instructor adapter and
  rejects Anthropic clients at runtime. Use the manual `compute_faithfulness()` in `backend/tests/eval_run.py`.

## What NOT to Do

- Do not use LlamaIndex (rejected — unnecessary abstraction)
- Do not use Keycloak (rejected — FastAPI JWT is sufficient)
- Do not use Pinecone or any managed vector DB (data residency violation)
- Do not use OpenAI embeddings (data egress violation)
