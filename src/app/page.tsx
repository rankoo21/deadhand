"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { getAdapter, type PhaseUpdate, type ProgressPhase, type TestLensResult, type TestLensSummary } from "@/lib/genlayer";

const categories = [
  ["happy_path", "Happy path", "Expected behavior under valid input"],
  ["errors", "Errors", "Failures, invalid input, and recovery"],
  ["permissions", "Permissions", "Identity, roles, and forbidden access"],
  ["edge_cases", "Edge cases", "Boundaries, duplicates, and unusual state"],
] as const;
const phases: { id: ProgressPhase; label: string }[] = [
  { id: "connecting", label: "Connect" }, { id: "signing", label: "Sign" },
  { id: "submitted", label: "Submitted" }, { id: "consensus", label: "Consensus" },
  { id: "accepted", label: "Accepted" }, { id: "verifying", label: "Verify" },
  { id: "complete", label: "Canonical" },
];
const emptySummary: TestLensSummary = { total: 0, covered: 0, partial: 0, insufficient: 0 };

function compact(value: string, size = 8) {
  return value.length > size * 2 ? `${value.slice(0, size)}...${value.slice(-size)}` : value;
}

function newRequestId() {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `check-${Date.now().toString(36)}-${suffix}`;
}

function ResultView({ result, preview, reduced }: { result: TestLensResult; preview: boolean; reduced: boolean }) {
  return (
    <section className="result-panel" aria-labelledby="result-title">
      <div className="section-heading result-heading">
        <div><p className="context-label">{preview ? "Local preview" : "Canonical assessment"}</p><h2 id="result-title">Coverage signal</h2></div>
        <div className="badge-row"><span className={`badge verdict-${result.verdict}`}>{result.verdict}</span><span className="badge badge-neutral">{result.confidence} confidence</span></div>
      </div>
      <p className="result-explanation">{result.explanation}</p>
      <div className="criteria-grid">
        {categories.map(([key, title, subtitle], index) => {
          const check = result.checks[key];
          return (
            <motion.article className="criterion" key={key} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduced ? 0 : index * 0.04 }}>
              <div className="criterion-top"><span className="criterion-label">Coverage category</span><span className={`status status-${check.status}`}>{check.status}</span></div>
              <h3>{title}</h3><p className="criterion-subtitle">{subtitle}</p>
              <div className="evidence"><span>Evidence trace</span><code>{check.evidence || "No grounded evidence"}</code></div>
              {check.status !== "covered" && <p className="missing-inline">{check.missing_test}</p>}
            </motion.article>
          );
        })}
      </div>
      <div className="result-lower">
        <div><h3 className="subheading">Missing test cases</h3>{result.missing_test_cases.length ? <ol className="missing-list">{result.missing_test_cases.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ol> : <p className="muted">No missing cases were identified.</p>}</div>
        <div className="proof"><h3 className="subheading">Result record</h3><dl><div><dt>Request</dt><dd><code>{result.request_id}</code></dd></div><div><dt>Sender</dt><dd><code>{compact(result.sender)}</code></dd></div><div><dt>Recorded</dt><dd>{new Date(result.submitted_at).toLocaleString()}</dd></div></dl></div>
      </div>
    </section>
  );
}

export default function Home() {
  const adapter = useMemo(() => getAdapter(), []);
  const reduced = Boolean(useReducedMotion());
  const preview = adapter.mode === "preview";
  const configuredNetwork = process.env.NEXT_PUBLIC_TESTLENS_NETWORK ?? "studionet";
  const networkName = preview ? "Offline" : configuredNetwork.toLowerCase().includes("bradbury") ? "Bradbury" : configuredNetwork;
  const [requirement, setRequirement] = useState("");
  const [tests, setTests] = useState("");
  const [risk, setRisk] = useState("");
  const [errors, setErrors] = useState<{ requirement?: string; tests?: string }>({});
  const [phase, setPhase] = useState<ProgressPhase>("idle");
  const [phaseDetail, setPhaseDetail] = useState(preview ? "Ready for a local, non-canonical preview." : "Ready to connect and submit.");
  const [hash, setHash] = useState<string | null>(null);
  const [result, setResult] = useState<TestLensResult | null>(null);
  const [recent, setRecent] = useState<TestLensResult[]>([]);
  const [summary, setSummary] = useState<TestLensSummary>(emptySummary);
  const [busy, setBusy] = useState(false);
  const [address, setAddress] = useState<string | null>(adapter.connectedAddress);
  const requirementRef = useRef<HTMLTextAreaElement>(null);
  const testsRef = useRef<HTMLTextAreaElement>(null);

  const refresh = useCallback(async () => {
    const [nextSummary, nextRecent] = await Promise.all([adapter.getSummary(), adapter.getResults(0, 6)]);
    setSummary(nextSummary); setRecent(nextRecent);
  }, [adapter]);

  useEffect(() => {
    const unsubscribe = adapter.subscribe((update: PhaseUpdate) => {
      setPhase(update.phase); if (update.detail) setPhaseDetail(update.detail); if (update.hash) setHash(update.hash);
    });
    void refresh().catch(() => setPhaseDetail("Recent state is temporarily unavailable."));
    if (!preview) {
      try {
        const pending = adapter.getPending();
        if (pending) {
          setHash(pending.hash); setBusy(true);
          setPhaseDetail("A saved transaction was found. Select the submitting wallet to recover it.");
          adapter.recoverPending().then((recovered) => { if (recovered) setResult(recovered); setAddress(adapter.connectedAddress); return refresh(); })
            .catch((error: unknown) => { setPhase("error"); setPhaseDetail(error instanceof Error ? error.message : "Pending recovery failed."); })
            .finally(() => setBusy(false));
        }
      } catch (error) {
        setPhase("error"); setPhaseDetail(error instanceof Error ? error.message : "Pending recovery data is invalid.");
      }
    }
    return unsubscribe;
  }, [adapter, preview, refresh]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!requirement.trim()) nextErrors.requirement = "Enter the feature behavior to review.";
    else if (requirement.length > 3000) nextErrors.requirement = "Keep the requirement at 3000 characters or fewer.";
    if (!tests.trim()) nextErrors.tests = "Enter the tests or scenarios that currently exist.";
    else if (tests.length > 10000) nextErrors.tests = "Keep the tests summary at 10000 characters or fewer.";
    setErrors(nextErrors);
    if (nextErrors.requirement) { requirementRef.current?.focus(); return; }
    if (nextErrors.tests) { testsRef.current?.focus(); return; }
    setBusy(true); setResult(null); setPhase("idle");
    try {
      const pending = adapter.getPending();
      if (pending) setHash(pending.hash);
      const next = await adapter.submitCheck({ requestId: pending?.request ?? newRequestId(), featureRequirement: requirement, testsSummary: tests, riskContext: risk });
      setResult(next); setAddress(adapter.connectedAddress); await refresh();
    } catch (error) {
      setPhase("error"); setPhaseDetail(error instanceof Error ? error.message : "The review could not be completed.");
    } finally { setBusy(false); }
  }

  const phaseIndex = phases.findIndex((item) => item.id === phase);
  const explorerUrl = hash ? adapter.getExplorerUrl(hash) : null;
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="TestLens home"><span className="brand-mark">TL</span><span>TestLens</span></a>
        <div className="connection-state" aria-label="Network and wallet status">
          <div className="network-state"><span className={`mode-dot ${preview ? "preview-dot" : "contract-dot"}`} /><span>Network</span><strong>{networkName}</strong></div>
          <div className="wallet-state"><span>Wallet</span><code>{address ? compact(address) : preview ? "Not used" : "Not connected"}</code></div>
        </div>
      </header>
      <div className="page" id="top">
        <section className="hero"><div><p className="eyebrow">Requirement to test comparison</p><h1>See where your test suite stops.</h1><p className="hero-copy">Compare a feature requirement with the tests you supply. TestLens reviews four risk categories and returns grounded gaps without inventing evidence.</p></div><div className="summary-grid" aria-label="Review summary"><div><strong>{summary.total}</strong><span>Total reviews</span></div><div><strong>{summary.covered}</strong><span>Covered</span></div><div><strong>{summary.partial}</strong><span>Partial</span></div><div><strong>{summary.insufficient}</strong><span>Insufficient</span></div></div></section>
        {preview && <aside className="mode-notice" role="note"><strong>Local preview</strong><span>Results are deterministic interface examples. They are not validator consensus, canonical contract state, or on-chain records.</span></aside>}
        <div className="workspace">
          <section className="input-panel" aria-labelledby="review-input-title">
            <div className="section-heading"><div><p className="context-label">Review input</p><h2 id="review-input-title">Coverage brief</h2></div></div>
            <form onSubmit={submit} noValidate>
              <div className="field"><div className="label-row"><label htmlFor="requirement">Feature requirement</label><span>{requirement.length} / 3000</span></div><textarea ref={requirementRef} id="requirement" value={requirement} onChange={(event) => setRequirement(event.target.value)} onBlur={() => setErrors((current) => ({ ...current, requirement: !requirement.trim() ? "Enter the feature behavior to review." : requirement.length > 3000 ? "Keep the requirement at 3000 characters or fewer." : undefined }))} aria-describedby={`requirement-help${errors.requirement ? " requirement-error" : ""}`} aria-invalid={Boolean(errors.requirement)} placeholder="Example: A signed-in editor can publish a draft, while viewers and anonymous users cannot." /><p className="helper" id="requirement-help">Describe observable behavior, actors, constraints, and expected outcomes.</p>{errors.requirement && <p className="field-error" id="requirement-error" role="alert">{errors.requirement}</p>}</div>
              <div className="field"><div className="label-row"><label htmlFor="tests">Tests summary</label><span>{tests.length} / 10000</span></div><textarea ref={testsRef} className="tests-input" id="tests" value={tests} onChange={(event) => setTests(event.target.value)} onBlur={() => setErrors((current) => ({ ...current, tests: !tests.trim() ? "Enter the tests or scenarios that currently exist." : tests.length > 10000 ? "Keep the tests summary at 10000 characters or fewer." : undefined }))} aria-describedby={`tests-help${errors.tests ? " tests-error" : ""}`} aria-invalid={Boolean(errors.tests)} placeholder={"test_publish_draft_as_editor\ntest_publish_requires_title\ntest_viewer_cannot_publish"} /><p className="helper" id="tests-help">Use test names, scenario descriptions, or concise assertions. Literal lines may be used as evidence.</p>{errors.tests && <p className="field-error" id="tests-error" role="alert">{errors.tests}</p>}</div>
              <div className="field"><div className="label-row"><label htmlFor="risk">Risk context <span className="optional">Optional</span></label><span>{risk.length} / 3000</span></div><textarea className="risk-input" id="risk" value={risk} onChange={(event) => setRisk(event.target.value)} maxLength={3000} aria-describedby="risk-help" placeholder="Security, data loss, compliance, or high-cost failure context." /><p className="helper" id="risk-help">Add context that should influence strictness. It does not count as test evidence.</p></div>
              <button className="primary-button" type="submit" disabled={busy} aria-describedby="submit-safety"><span>{busy ? (preview ? "Reviewing input" : "Waiting for GenLayer") : (preview ? "Run local preview" : "Submit canonical review")}</span><span aria-hidden="true">{busy ? "..." : ">"}</span></button>
              <p className="submit-safety" id="submit-safety">{preview ? "No wallet or network request is used." : "Submitting requests one wallet signature and creates exactly one contract write."}</p>
            </form>
          </section>
          <aside className="process-panel" aria-labelledby="process-title"><div className="section-heading"><div><p className="context-label">Transaction state</p><h2 id="process-title">Review lifecycle</h2></div></div><ol className="phase-list">{phases.map((item, index) => { const active = phase === item.id; const complete = phase === "complete" || (phaseIndex > index && phaseIndex >= 0); return <li className={`${active ? "phase-active" : ""} ${complete ? "phase-complete" : ""}`} key={item.id} aria-current={active ? "step" : undefined}><span className="phase-node">{complete ? "OK" : String(index + 1).padStart(2, "0")}</span><span>{item.label}</span></li>; })}</ol><div className={`phase-detail ${phase === "error" ? "phase-error" : ""}`} role={phase === "error" ? "alert" : "status"} aria-live={phase === "error" ? "assertive" : "polite"} aria-atomic="true"><span>{phase === "error" ? "Review error" : phase === "idle" ? "Ready" : phases.find((item) => item.id === phase)?.label}</span><p>{phaseDetail}</p></div>{hash && <div className="hash-card"><span>Saved transaction</span><code>{compact(hash, 12)}</code>{explorerUrl && <a href={explorerUrl} target="_blank" rel="noreferrer">Open transaction in explorer</a>}</div>}<p className="safety-copy">{preview ? "Preview output stays in this browser session." : "The returned hash is saved and reused for recovery. TestLens never automatically resubmits it."}</p></aside>
        </div>
        <div aria-live="polite" aria-atomic="true" className="sr-only">{result ? `${preview ? "Preview" : "Canonical"} result: ${result.verdict}, ${result.confidence} confidence.` : ""}</div>
        {result && <ResultView result={result} preview={preview} reduced={reduced} />}
        <section className="recent-panel" aria-labelledby="recent-title"><div className="section-heading"><div><p className="context-label">{preview ? "Session output" : "Canonical state"}</p><h2 id="recent-title">Recent reviews</h2></div></div>{recent.length ? <div className="recent-list">{recent.map((item) => <article key={`${item.sender}-${item.request_id}`}><span className={`recent-signal verdict-${item.verdict}`} aria-hidden="true" /><div><strong>{item.request_id}</strong><span>{new Date(item.submitted_at).toLocaleString()}</span></div><span className={`badge verdict-${item.verdict}`}>{item.verdict}</span><span className="recent-confidence">{item.confidence}</span></article>)}</div> : <p className="empty-state">No {preview ? "preview" : "canonical"} reviews are available yet.</p>}</section>
      </div>
      <footer><span>TestLens</span><span>Grounded software test review on GenLayer</span></footer>
    </main>
  );
}
