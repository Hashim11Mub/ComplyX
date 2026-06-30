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

