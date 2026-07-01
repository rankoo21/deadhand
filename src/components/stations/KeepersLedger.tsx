"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useChamberStore } from "@/store/useChamberStore";
import { absoluteTime, shortAddress } from "@/utils/format";
import type { LedgerEntry } from "@/lib/genlayer/types";

// Station 6: The Keeper's Ledger. The archive of sealed and opened vaults, never
// a history table. A heavy ledger book on a lectern, parchment pages, each entry
// an inked record with a small wax dot whose color reflects state. Turning a
// page flips with weight; clicking an entry unfolds the inked record.

function waxDotColor(state: string): string {
  switch (state) {
    case "opened":
      return "#9C6B3C";
    case "releasable":
      return "#E07A3C";
    case "nearing":
      return "#F2C14E";
    case "dormant":
      return "#6E6A63";
    default:
      return "#C0392B";
  }
}

function exportEntry(entry: LedgerEntry, kind: "md" | "json" | "txt") {
  let content = "";
  let ext = kind;
  let mime = "text/plain";
  if (kind === "md") {
    content = `# ${entry.title}\n\n- Condition: ${entry.conditionText}\n- Recipient: ${entry.recipient}\n- Sealed at: ${absoluteTime(entry.sealedAt)}\n- Opened at: ${absoluteTime(entry.openedAt)}\n- Evidence trail: ${entry.evidenceTrail}\n- Record: ${entry.mockTxHash}\n- State: ${entry.state}\n`;
    mime = "text/markdown";
  } else if (kind === "json") {
    content = JSON.stringify(entry, null, 2);
    mime = "application/json";
  } else {
    content = `${entry.title}\nCondition: ${entry.conditionText}\nRecipient: ${entry.recipient}\nSealed: ${absoluteTime(entry.sealedAt)}\nOpened: ${absoluteTime(entry.openedAt)}\nEvidence: ${entry.evidenceTrail}\nRecord: ${entry.mockTxHash}\n`;
    ext = "txt";
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${entry.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

export function KeepersLedger() {
  const reduced = useReducedMotion();
  const ledger = useChamberStore((s) => s.ledger);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="mx-auto max-w-3xl" aria-label="The Keeper's Ledger">
      <header className="mb-8 text-center">
        <h2 className="font-display text-2xl tracking-[0.12em] text-[#E8E0CF]">The Keeper's Ledger</h2>
        <p className="mt-2 font-display text-sm italic text-[rgba(232,224,207,0.5)]">
          Opened at last. A rubbing kept.
        </p>
      </header>

      {/* The ledger book on its lectern. */}
      <div
        className="parchment rounded-sm px-8 py-9"
        style={{ boxShadow: "inset 0 0 60px rgba(120,90,50,0.3), 0 30px 60px -30px rgba(0,0,0,0.85)" }}
      >
        {ledger.length === 0 ? (
          <p className="py-10 text-center font-display text-lg italic text-[#6b4a28]">
            No seal has yet melted. The pages wait, unmarked.
          </p>
        ) : (
          <ul className="divide-y divide-[rgba(58,42,24,0.25)]">
            {ledger.map((entry) => {
              const open = openId === entry.id;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : entry.id)}
                    aria-expanded={open}
                    className="focus-ring flex w-full items-center gap-4 py-4 text-left"
                  >
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full"
                      style={{
                        background: waxDotColor(entry.state),
                        boxShadow: `0 0 8px ${waxDotColor(entry.state)}aa`,
                      }}
                      aria-hidden
                    />
                    <span className="flex-1">
                      <span className="block font-display text-lg text-[#3a2a18]">{entry.title}</span>
                      <span className="block font-display text-xs uppercase tracking-[0.2em] text-[#6b4a28]">
                        Opened {absoluteTime(entry.openedAt)}
                      </span>
                    </span>
                    <span className="font-display text-xs uppercase tracking-[0.2em] text-[#8a5a2e]">
                      {entry.state}
                    </span>
                  </button>

                  {/* The unfolded inked record, flipping with weight. */}
                  <AnimatePresence>
                    {open && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, rotateX: reduced ? 0 : -8 }}
                        animate={{ opacity: 1, height: "auto", rotateX: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: reduced ? 0.15 : 0.55, ease: [0.22, 1, 0.36, 1] }}
                        style={{ transformOrigin: "top" }}
                        className="overflow-hidden"
                      >
                        <div className="pb-5 pl-8 font-display text-[#3a2a18]">
                          <p className="mb-1 text-base italic">{entry.conditionText}</p>
                          <dl className="mt-2 space-y-1 text-sm text-[#5a4226]">
                            <div className="flex gap-3">
                              <dt className="w-28 text-[#8a5a2e]">Recipient</dt>
                              <dd>{shortAddress(entry.recipient)}</dd>
                            </div>
                            <div className="flex gap-3">
                              <dt className="w-28 text-[#8a5a2e]">Sealed at</dt>
                              <dd>{absoluteTime(entry.sealedAt)}</dd>
                            </div>
                            <div className="flex gap-3">
                              <dt className="w-28 text-[#8a5a2e]">Evidence trail</dt>
                              <dd className="flex-1">{entry.evidenceTrail}</dd>
                            </div>
                            <div className="flex gap-3">
                              <dt className="w-28 text-[#8a5a2e]">Record</dt>
                              <dd className="break-all font-mono text-xs">{entry.mockTxHash}</dd>
                            </div>
                          </dl>

                          <div className="mt-4 flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() => exportEntry(entry, "md")}
                              className="focus-ring rounded-sm border border-[rgba(58,42,24,0.35)] px-4 py-2 text-[0.66rem] uppercase tracking-[0.2em] text-[#5a4226] hover:border-[rgba(58,42,24,0.7)]"
                            >
                              Take a rubbing
                            </button>
                            <button
                              type="button"
                              onClick={() => exportEntry(entry, "json")}
                              className="focus-ring rounded-sm border border-[rgba(58,42,24,0.35)] px-4 py-2 text-[0.66rem] uppercase tracking-[0.2em] text-[#5a4226] hover:border-[rgba(58,42,24,0.7)]"
                            >
                              Press a copy
                            </button>
                            <button
                              type="button"
                              onClick={() => exportEntry(entry, "txt")}
                              className="focus-ring rounded-sm border border-[rgba(58,42,24,0.35)] px-4 py-2 text-[0.66rem] uppercase tracking-[0.2em] text-[#5a4226] hover:border-[rgba(58,42,24,0.7)]"
                            >
                              Read aloud
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
