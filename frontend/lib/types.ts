export type Lang = "ar" | "en";

export type AppState = "input" | "clarifying" | "scanning" | "results";

export type InputMode = "describe" | "upload" | "voice";

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
