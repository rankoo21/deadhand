export type TransactionHash = `0x${string}`;
export type Verdict = "covered" | "partial" | "insufficient";
export type Confidence = "low" | "medium" | "high";
export type CheckStatus = "covered" | "partial" | "missing";
export type CheckCategory = "happy_path" | "errors" | "permissions" | "edge_cases";

export interface CategoryCheck {
  status: CheckStatus;
  evidence: string;
  missing_test: string;
}

export interface TestLensResult {
  request_id: string;
  sender: string;
  verdict: Verdict;
  confidence: Confidence;
  checks: Record<CheckCategory, CategoryCheck>;
  missing_test_cases: string[];
  explanation: string;
  submitted_at: number;
}

export interface TestLensSummary {
  total: number;
  covered: number;
  partial: number;
  insufficient: number;
}

export interface SubmitCheckInput {
  requestId: string;
  featureRequirement: string;
  testsSummary: string;
  riskContext?: string;
}

export type ProgressPhase =
  | "idle" | "connecting" | "signing" | "submitted" | "consensus"
  | "accepted" | "verifying" | "complete" | "error";

export interface PendingCheck {
  app: "testlens";
  request: string;
  hash: TransactionHash;
  account: `0x${string}`;
  timestamp: number;
}

export interface PhaseUpdate {
  phase: ProgressPhase;
  detail?: string;
  hash?: TransactionHash;
}