"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useChamberStore } from "@/store/useChamberStore";
import { Vault } from "@/components/vault/Vault";
import { InkInput } from "@/components/ui/InkInput";
import { STATE_COPY } from "@/utils/vaultState";
import { relativeTime, shortAddress, SIGIL_LABELS } from "@/utils/format";
import { EVIDENCE_TEMPLATES, strongEvidenceFor } from "@/data/mockEvidence";
import type { Vault as VaultModel } from "@/lib/genlayer/types";

// Station 4: The Vault Hall. The main operating space, never a dashboard. A
// long candlelit hall of bronze vaults on stone shelves, each with its own
// gauge ring. Per-vault actions appear as small engraved controls around the
// selected vault, not buttons in a card.

function EngravedControl({
  label,
  onClick,
  disabled,
  tone = "stone",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "stone" | "ember" | "gold";
}) {
  const color =
    tone === "ember"
      ? "text-[#E07A3C] border-[rgba(224,122,60,0.4)] hover:border-[rgba(224,122,60,0.85)]"
      : tone === "gold"
        ? "text-[#F2C14E] border-[rgba(242,193,78,0.4)] hover:border-[rgba(242,193,78,0.85)]"
        : "text-[rgba(232,224,207,0.75)] border-[rgba(156,107,60,0.3)] hover:border-[rgba(156,107,60,0.7)]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`focus-ring rounded-sm border bg-[rgba(10,8,7,0.5)] px-4 py-2 font-display text-[0.7rem] uppercase tracking-[0.24em] transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${color}`}
    >
      {label}
    </button>
  );
}

function VaultPlaque({ vault }: { vault: VaultModel }) {
  const copy = STATE_COPY[vault.state];
  return (
    <div className="bronze-surface rounded-sm px-5 py-4 text-left">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-display text-base text-[#E8E0CF]">{vault.title}</span>
        <span className="font-display text-[0.66rem] uppercase tracking-[0.24em] text-[#9C6B3C]">
          {SIGIL_LABELS[vault.sigil]}
        </span>
      </div>
      <dl className="space-y-1 font-display text-sm text-[rgba(232,224,207,0.7)]">
        <div className="flex justify-between gap-4">
          <dt className="text-[rgba(156,107,60,0.85)]">Keeper</dt>
          <dd>{shortAddress(vault.recipient)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[rgba(156,107,60,0.85)]">Condition</dt>
          <dd className="max-w-[18rem] text-right italic">
            {vault.conditionShrouded ? "Shrouded until opened" : vault.conditionText || "Not yet bound"}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[rgba(156,107,60,0.85)]">Last world-check</dt>
          <dd>{relativeTime(vault.lastCheckedAt)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[rgba(156,107,60,0.85)]">State</dt>
          <dd className="text-[#F2C14E]">{copy.label}</dd>
        </div>
      </dl>
      <p className="mt-2 font-display text-xs italic text-[rgba(232,224,207,0.45)]">{copy.whisper}</p>
    </div>
  );
}

export function VaultHall() {
  const reduced = useReducedMotion();
  const vaults = useChamberStore((s) => s.vaults);
  const activeVaultId = useChamberStore((s) => s.activeVaultId);
  const setActiveVault = useChamberStore((s) => s.setActiveVault);
  const checkWorld = useChamberStore((s) => s.checkWorld);
  const checkTheHall = useChamberStore((s) => s.checkTheHall);
  const beginMelt = useChamberStore((s) => s.beginMelt);
  const entrust = useChamberStore((s) => s.entrust);
  const setStation = useChamberStore((s) => s.setStation);
  const signetAddress = useChamberStore((s) => s.signetAddress);
  const busy = useChamberStore((s) => s.busy);

  const [flare, setFlare] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [revealCondition, setRevealCondition] = useState<Record<string, boolean>>({});
  const [entrustOpen, setEntrustOpen] = useState(false);
  const [newKeeper, setNewKeeper] = useState("");

  const active = useMemo(
    () => vaults.find((v) => v.id === activeVaultId) ?? null,
    [vaults, activeVaultId],
  );

  const runHallFlare = async () => {
    setFlare(true);
    await checkTheHall();
    setTimeout(() => setFlare(false), 1400);
  };

  const submitCheck = async (vault: VaultModel) => {
    const ev = evidence.trim() || strongEvidenceFor(vault.conditionText).snapshot;
    const label = sourceLabel.trim() || strongEvidenceFor(vault.conditionText).label;
    await checkWorld(vault.id, ev, label);
    setEvidence("");
    setSourceLabel("");
    setCheckingId(null);
  };

  if (vaults.length === 0) {
    return (
      <section className="flex min-h-[60vh] flex-col items-center justify-center text-center" aria-label="The Vault Hall">
        <p className="font-display text-lg italic text-[rgba(232,224,207,0.6)]">
          The hall stands empty. No seal has yet been pressed.
        </p>
        <button
          type="button"
          onClick={() => setStation("table")}
          className="focus-ring mt-6 rounded-sm border border-[rgba(192,57,43,0.4)] px-7 py-3 font-display text-sm uppercase tracking-[0.3em] text-[#E8E0CF] transition-colors hover:border-[rgba(192,57,43,0.85)]"
        >
          Press a new seal
        </button>
      </section>
    );
  }

  return (
    <section aria-label="The Vault Hall">
      <header className="mb-8 flex flex-col items-center gap-3 text-center">
        <h2 className="font-display text-2xl tracking-[0.12em] text-[#E8E0CF]">The Vault Hall</h2>
        <p className="font-display text-sm italic text-[rgba(232,224,207,0.5)]">
          Held shut until it is true.
        </p>
        <button
          type="button"
          onClick={() => void runHallFlare()}
          disabled={busy}
          className="focus-ring mt-1 rounded-sm border border-[rgba(242,193,78,0.4)] px-6 py-2.5 font-display text-xs uppercase tracking-[0.3em] text-[#F2C14E] transition-colors hover:border-[rgba(242,193,78,0.85)] disabled:opacity-40"
        >
          Check the hall
        </button>
      </header>

      {/* The candle-flare sweep down the hall. */}
      <AnimatePresence>
        {flare && !reduced && (
          <motion.div
            className="pointer-events-none fixed inset-y-0 left-0 z-20 w-40"
            style={{ background: "linear-gradient(90deg, transparent, rgba(242,193,78,0.18), transparent)" }}
            initial={{ x: "-10vw" }}
            animate={{ x: "100vw" }}
            transition={{ duration: 1.3, ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>

      {/* The hall: vaults on a shelf, scroll-panning horizontally on desktop and
          stacking vertically on mobile. */}
      <div className="relative">
        <div
          className="flex snap-x gap-6 overflow-x-auto pb-6 max-md:flex-col max-md:items-center"
          style={{ scrollbarGutter: "stable" }}
        >
          {vaults.map((v) => (
            <div key={v.id} className="snap-start shrink-0">
              <Vault vault={v} active={v.id === activeVaultId} onSelect={setActiveVault} />
            </div>
          ))}
        </div>
        {/* The stone shelf line. */}
        <div
          className="mt-1 hidden h-2 w-full rounded-sm md:block"
          style={{ background: "linear-gradient(180deg, rgba(110,106,99,0.28), rgba(10,8,7,0.9))" }}
        />
      </div>

      {/* The selected vault: plaque and engraved radial controls. */}
      <AnimatePresence mode="wait">
        {active && (
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5 }}
            className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2"
          >
            <VaultPlaque vault={active} />

            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-3">
                <EngravedControl
                  label="Check the world"
                  tone="gold"
                  disabled={busy || active.opened || !active.conditionBound}
                  onClick={() => setCheckingId(checkingId === active.id ? null : active.id)}
                />
                <EngravedControl
                  label={revealCondition[active.id] ? "Hide condition" : "Read condition"}
                  onClick={() =>
                    setRevealCondition((m) => ({ ...m, [active.id]: !m[active.id] }))
                  }
                />
                <EngravedControl
                  label="Open"
                  tone="ember"
                  disabled={active.state !== "releasable"}
                  onClick={() => beginMelt(active.id)}
                />
                <EngravedControl
                  label="Entrust"
                  disabled={busy || active.opened}
                  onClick={() => setEntrustOpen((v) => !v)}
                />
              </div>

              {revealCondition[active.id] && (
                <p className="font-display text-base italic text-[rgba(232,224,207,0.8)]">
                  {active.conditionShrouded
                    ? "This condition is shrouded. Only the author and keeper may read it."
                    : active.conditionText || "No condition is bound yet."}
                </p>
              )}

              {/* Check-the-world groove: read a public evidence snapshot. */}
              <AnimatePresence>
                {checkingId === active.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="stone-surface rounded-sm p-4">
                      <p className="mb-2 font-display text-xs uppercase tracking-[0.26em] text-[#9C6B3C]">
                        Let the keepers read a public trace
                      </p>
                      <InkInput
                        ariaLabel="Public evidence snapshot for the world-check"
                        variant="groove"
                        multiline
                        rows={3}
                        maxLength={2000}
                        value={evidence}
                        onChange={setEvidence}
                        placeholder="Paste a public evidence snapshot, or leave blank to use a sample trace."
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        {EVIDENCE_TEMPLATES.slice(0, 4).map((t) => (
                          <button
                            key={t.label}
                            type="button"
                            onClick={() => {
                              setEvidence(t.snapshot);
                              setSourceLabel(t.label);
                            }}
                            className="focus-ring rounded-sm border border-[rgba(156,107,60,0.3)] px-3 py-1.5 font-display text-[0.64rem] uppercase tracking-[0.18em] text-[rgba(232,224,207,0.65)] transition-colors hover:border-[rgba(156,107,60,0.7)]"
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                      <div className="mt-4 flex justify-end">
                        <EngravedControl
                          label="Check the world"
                          tone="gold"
                          disabled={busy}
                          onClick={() => void submitCheck(active)}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Entrust groove: hand keeper rights to another address. */}
              <AnimatePresence>
                {entrustOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="stone-surface rounded-sm p-4">
                      <p className="mb-2 font-display text-xs uppercase tracking-[0.26em] text-[#9C6B3C]">
                        Entrust to another keeper
                      </p>
                      <InkInput
                        ariaLabel="The new keeper address"
                        variant="groove"
                        maxLength={120}
                        value={newKeeper}
                        onChange={setNewKeeper}
                        placeholder="An address or a named keeper."
                      />
                      <div className="mt-3 flex justify-end">
                        <EngravedControl
                          label="Entrust the seal"
                          disabled={busy || !newKeeper.trim()}
                          onClick={async () => {
                            await entrust(active.id, newKeeper.trim());
                            setNewKeeper("");
                            setEntrustOpen(false);
                          }}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {active.owner !== signetAddress && signetAddress && (
                <p className="font-display text-[0.66rem] uppercase tracking-[0.2em] text-[rgba(156,107,60,0.7)]">
                  This seal was pressed by another hand. Only its keeper may open it.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
