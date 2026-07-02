export type Lang = "ar" | "en";

export type AppState = "input" | "scanning" | "results";

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
