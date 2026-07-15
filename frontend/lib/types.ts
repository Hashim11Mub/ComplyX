export type Lang = "ar" | "en";

export type AppState = "input" | "clarifying" | "scanning" | "results";

export type ProductType =
  | "open_banking"
  | "aml"
  | "consumer_finance"
  | "pdpl"
  | "payment_services"
  | "general";

export type Requirement = {
  id: string;
  source: string;
  article: string;
  title: string;
  text: string;
  keywords: string[];
  regulator?: string; // SAMA | SDAIA | AAOIFI | CMA
};

export type Corpus = "sama" | "pdpl" | "shariah" | "cma";

export type RetrievedArticle = {
  source: string;
  article: string;
  title: string;
  regulator: string;
};

export type HealthInfo = {
  status: string;
  indexed_articles: number;
  ready: boolean;
  corpus_version?: string;
  corpora?: Record<string, number>;
};

export type Finding = {
  requirement: Requirement;
  status: "compliant" | "gap" | "needs_review";
  risk: "low" | "medium" | "high";
  analysis: string;
  recommendation: string;
  /** Set when the finding relies on an answer the user gave in the clarification interview. */
  user_answer_ref?: string;
};

/** Mirrors backend GateInfo (models.py). A non-compensatory severity gate that
 * capped the score; present only when it actually lowered the score. */
export type GateInfo = {
  kind: "high_gap" | "medium_gap";
  cap: number;
  findings: number[]; // indexes into ComplianceResult.findings
};

/** Mirrors backend ScoreBreakdown (models.py). penalties[] aligns with
 * findings[] by index. */
export type ScoreBreakdown = {
  base: number;
  penalties: number[];
  subtotal: number;
  gate: GateInfo | null;
  final: number;
  driver: "gaps" | "reviews" | "mixed" | "none";
};

export type ComplianceResult = {
  product_type: ProductType;
  compliance_score: number;
  risk_level: "low" | "medium" | "high";
  gaps_count: number;
  findings: Finding[];
  executive_summary: string;
  agent_steps: string[];
  disclaimer: string;
  /** Always present on fresh backend responses; optional because results can
   * predate v3 (stale session) and the PDF endpoint recomputes it anyway. */
  score_breakdown?: ScoreBreakdown | null;
};

export type ProductIcon = "wallet" | "bnpl" | "gateway" | "robo" | "api" | "crypto";

export type ProductOption = {
  id: string;
  labelEn: string;
  labelAr: string;
  icon: ProductIcon;
  regulatoryType: ProductType;
};

export type Preset = {
  id: string;
  labelEn: string;
  labelAr: string;
  productId: string;
  textEn: string;
  textAr: string;
};

export type PipelineStep = {
  labelEn: string;
  labelAr: string;
};

export type ClarifyOption = {
  value: string;
  label_en: string;
  label_ar: string;
};

export type ClarifyQuestion = {
  id: string;
  text_en: string;
  text_ar: string;
  allow_multiple: boolean;
  options: ClarifyOption[];
};

export type ClarifyResponse = {
  questions: ClarifyQuestion[];
};

/** Mirrors backend ChatFindingBrief (models.py). */
export type ChatFindingBrief = {
  title: string;
  status: string;
  risk: string;
  article: string;
  source: string;
  regulator?: string;
};

/** Mirrors backend ChatSessionContext (models.py) — what the assistant knows
 * about the current session. Send whatever exists when the question is asked. */
export type ChatSessionContext = {
  product_type?: string;
  product_description?: string;
  uploaded_file_name?: string;
  clarified_answers?: string[];
  compliance_score?: number | null;
  risk_level?: string;
  gaps_count?: number | null;
  findings?: ChatFindingBrief[];
  executive_summary?: string;
  lang?: "ar" | "en";
};
