import type { PhaseUpdate, SubmitCheckInput, TestLensResult, TestLensSummary } from "./types";

// Local preview only. This adapter demonstrates the UI and never represents
// its deterministic output as GenLayer consensus or on-chain proof.
export class MockAdapter {
  readonly mode = "preview" as const;
  private results: TestLensResult[] = [];
  private listeners = new Set<(update: PhaseUpdate) => void>();

  subscribe(listener: (update: PhaseUpdate) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(update: PhaseUpdate): void {
    this.listeners.forEach((listener) => listener(update));
  }

  getExplorerUrl(): null {
    return null;
  }

  hasInjectedWallet(): boolean {
    return false;
  }

  get connectedAddress(): string | null {
    return null;
  }

  getPending(): null {
    return null;
  }

  async recoverPending(): Promise<null> {
    return null;
  }

  async submitCheck(input: SubmitCheckInput): Promise<TestLensResult> {
    this.emit({ phase: "consensus", detail: "Preview analysis only. No transaction is being submitted." });
    await new Promise((resolve) => setTimeout(resolve, 450));
    const checks = {
      happy_path: { status: "covered" as const, evidence: input.testsSummary.split("\n")[0] || "Supplied test summary", missing_test: "Add another representative success case." },
      errors: { status: "partial" as const, evidence: input.testsSummary.split("\n")[0] || "Supplied test summary", missing_test: "Add explicit failure-path assertions." },
      permissions: { status: "missing" as const, evidence: input.testsSummary.split("\n")[0] || "Supplied test summary", missing_test: "Add unauthorized and wrong-role tests." },
      edge_cases: { status: "partial" as const, evidence: input.testsSummary.split("\n")[0] || "Supplied test summary", missing_test: "Add empty, boundary, and duplicate-input tests." },
    };
    const result: TestLensResult = {
      request_id: input.requestId,
      sender: "local-preview",
      verdict: "partial",
      confidence: "low",
      checks,
      missing_test_cases: [checks.permissions.missing_test, checks.errors.missing_test, checks.edge_cases.missing_test],
      explanation: "Local preview identifies likely gaps from the supplied text. Connect contract mode for validator consensus and canonical state.",
      submitted_at: Date.now(),
    };
    this.results.unshift(result);
    this.emit({ phase: "complete", detail: "Preview complete; not persisted on-chain." });
    return result;
  }

  async getResult(requestId: string): Promise<TestLensResult | null> {
    return this.results.find((item) => item.request_id === requestId) ?? null;
  }

  async getResults(offset = 0, limit = 20): Promise<TestLensResult[]> {
    return this.results.slice(offset, offset + limit);
  }

  async getSummary(): Promise<TestLensSummary> {
    return {
      total: this.results.length,
      covered: this.results.filter((item) => item.verdict === "covered").length,
      partial: this.results.filter((item) => item.verdict === "partial").length,
      insufficient: this.results.filter((item) => item.verdict === "insufficient").length,
    };
  }
}
