"""
Deterministic compliance scoring (audit item I-5).

The LLM judges each requirement (status + risk); arithmetic sets the overall
score. Reproducible and explainable — no more "everything scores 62".
"""

from .models import Finding, RiskLevel

# Penalty per finding, by status and risk severity.
_PENALTY: dict[str, dict[str, int]] = {
    "gap": {"high": 16, "medium": 10, "low": 6},
    "needs_review": {"high": 8, "medium": 5, "low": 3},
    "compliant": {"high": 0, "medium": 0, "low": 0},
}

# Risk-level thresholds (kept identical to the original prompt contract).
LOW_RISK_MIN = 82
MEDIUM_RISK_MIN = 58


def projected_score(findings: list[Finding]) -> int:
    """Score if every gap were resolved (its penalty removed) while
    needs_review items stay as they are. Used by the report's "path to
    compliant" line; exact arithmetic from the same penalty table, so the
    projection is provable, never an estimate."""
    score = 100
    for finding in findings:
        if finding.status != "gap":
            score -= _PENALTY.get(finding.status, {}).get(finding.risk, 0)
    return max(5, min(100, score))


def score_findings(findings: list[Finding]) -> tuple[int, RiskLevel, int]:
    """Return (compliance_score, risk_level, gaps_count) derived from findings."""
    score = 100
    gaps = 0
    for finding in findings:
        score -= _PENALTY.get(finding.status, {}).get(finding.risk, 0)
        if finding.status == "gap":
            gaps += 1

    score = max(5, min(100, score))

    if score >= LOW_RISK_MIN:
        risk: RiskLevel = "low"
    elif score >= MEDIUM_RISK_MIN:
        risk = "medium"
    else:
        risk = "high"

    return score, risk, gaps
