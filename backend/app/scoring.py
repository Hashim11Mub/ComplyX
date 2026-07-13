"""
Deterministic compliance scoring, methodology v3 (adopted 2026-07-13).

The LLM judges each requirement (status + risk); arithmetic sets the overall
score. The LLM never emits a number, so every score is reproducible and every
band has a stated rule a professional can audit.

Stated meaning of the score (also rendered in the report's Scope and method):
  "The compliance score is a regulatory readiness index for the described
  product, computed deterministically from the severity profile of findings in
  this scan. It presumes compliance except where findings indicate otherwise,
  so it measures identified gap burden, not exhaustive coverage. It is a triage
  signal for prioritizing remediation and review, not a legal determination."

Methodology principles (each maps to a professional norm):
1. Non-compensatory severity gates: a confirmed critical breach caps the score
   into the matching band; strengths elsewhere cannot offset it. This mirrors
   supervisory worst-of logic (Basel-style SREP ratings, audit RAG statuses).
   Without gates, one high-severity gap plus seven compliant findings scored
   84/low under the pre-v3 model, which is indefensible.
2. Verbal band definitions first, numbers second:
     low    (82-100) "ready":       no confirmed gaps of medium/high severity;
                                    at most minor issues and open questions.
     medium (58-81)  "conditional": no high-severity confirmed gaps; moderate
                                    gaps and/or significant open questions.
     high   (5-57)   "not ready":   at least one high-severity confirmed gap,
                                    or accumulated gaps/unresolved questions.
   The gates enforce these words; the numeric score orders products within a
   band.
3. Geometric severity progression: gap penalties low:medium:high = 5:10:20,
   the standard 1:2:4 doubling used in risk matrices (replaces the pre-v3
   ad hoc 6/10/16).
4. Expected-value treatment of uncertainty: a needs_review is an unconfirmed
   potential breach, penalized at 50% of the equivalent confirmed gap
   (probability-weighted exposure), rounded conservatively upward (low: 2.5
   rounds to 3). Uncertainty alone never triggers a gate, but enough of it can
   sink the score on points.
5. Monotonicity: adding a finding never raises the score; resolving one never
   lowers it.

Changing any weight, gate, or threshold requires updating this docstring's
rationale, the report/README methodology text, and re-running the 20-product
eval. Do not hand-tune.
"""

from .models import Finding, GateInfo, RiskLevel, ScoreBreakdown

# Penalty per finding, by status and risk severity (principle 3 and 4).
_PENALTY: dict[str, dict[str, int]] = {
    "gap": {"high": 20, "medium": 10, "low": 5},
    "needs_review": {"high": 10, "medium": 5, "low": 3},
    "compliant": {"high": 0, "medium": 0, "low": 0},
}

# Severity gates (principle 1). Caps sit just below the band thresholds so a
# gated score always lands in the intended band.
_HIGH_GAP_CAP = 57    # any high-severity gap -> high band ("not ready")
_MEDIUM_GAP_CAP = 81  # else any medium-severity gap -> at most medium band

# Risk-level thresholds (unchanged from the original contract).
LOW_RISK_MIN = 82
MEDIUM_RISK_MIN = 58

SCORE_FLOOR = 5


def _penalty(finding: Finding) -> int:
    return _PENALTY.get(finding.status, {}).get(finding.risk, 0)


def projected_score(findings: list[Finding]) -> int:
    """Score if every gap were resolved: gap penalties removed and their gates
    lifted (gates only ever come from gaps), while needs_review items stay as
    they are. Used by the report's "path to compliant" line; exact arithmetic
    from the same penalty table, so the projection is provable, never an
    estimate."""
    score = 100
    for finding in findings:
        if finding.status != "gap":
            score -= _penalty(finding)
    return max(SCORE_FLOOR, min(100, score))


def score_findings(findings: list[Finding]) -> tuple[int, RiskLevel, int, ScoreBreakdown]:
    """Return (compliance_score, risk_level, gaps_count, breakdown).

    The breakdown carries the full arithmetic (per-finding penalties, the gate
    if one bound, and the dominant driver) so the report can show exactly why
    a product scored what it scored."""
    penalties = [_penalty(f) for f in findings]
    gaps = sum(1 for f in findings if f.status == "gap")

    subtotal = max(SCORE_FLOOR, min(100, 100 - sum(penalties)))

    # Severity gates: report the gate only when it actually lowers the score;
    # when the subtotal is already at or below the cap, the band outcome is
    # identical and a "capped" message would mislead.
    gate: GateInfo | None = None
    high_gap_idx = [i for i, f in enumerate(findings) if f.status == "gap" and f.risk == "high"]
    medium_gap_idx = [i for i, f in enumerate(findings) if f.status == "gap" and f.risk == "medium"]
    if high_gap_idx and subtotal > _HIGH_GAP_CAP:
        gate = GateInfo(kind="high_gap", cap=_HIGH_GAP_CAP, findings=high_gap_idx)
    elif not high_gap_idx and medium_gap_idx and subtotal > _MEDIUM_GAP_CAP:
        gate = GateInfo(kind="medium_gap", cap=_MEDIUM_GAP_CAP, findings=medium_gap_idx)

    score = min(subtotal, gate.cap) if gate else subtotal

    if score >= LOW_RISK_MIN:
        risk: RiskLevel = "low"
    elif score >= MEDIUM_RISK_MIN:
        risk = "medium"
    else:
        risk = "high"

    gap_burden = sum(p for f, p in zip(findings, penalties) if f.status == "gap")
    review_burden = sum(p for f, p in zip(findings, penalties) if f.status == "needs_review")
    if gap_burden == 0 and review_burden == 0:
        driver = "none"
    elif gap_burden > review_burden:
        driver = "gaps"
    elif review_burden > gap_burden:
        driver = "reviews"
    else:
        driver = "mixed"

    breakdown = ScoreBreakdown(
        base=100,
        penalties=penalties,
        subtotal=subtotal,
        gate=gate,
        final=score,
        driver=driver,
    )
    return score, risk, gaps, breakdown
