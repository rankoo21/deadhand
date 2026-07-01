"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useChamberStore } from "@/store/useChamberStore";
import { WaxSeal } from "@/components/vault/WaxSeal";
import { EngravedPanel } from "@/components/vault/EngravedPanel";
import { absoluteTime, shortAddress } from "@/utils/format";

// Station 5: The Melt. The cinematic, one-time opening of a releasable vault. A
// full-screen ceremony, never a modal or result page. The candle flares, the
// wax liquefies and drips, the sigil cracks and falls, the door swings, and the
// released message rises. Reduced motion replaces the melt with a calm dissolve.
export function TheMelt() {
  const reduced = useReducedMotion();
  const vaults = useChamberStore((s) => s.vaults);
  const meltVaultId = useChamberStore((s) => s.meltVaultId);
  const meltResult = useChamberStore((s) => s.meltResult);
  const evidenceByVault = useChamberStore((s) => s.evidenceByVault);
  const openSeal = useChamberStore((s) => s.openSeal);
  const setStation = useChamberStore((s) => s.setStation);
  const setDraft = useChamberStore((s) => s.setDraft);
  const resetDraft = useChamberStore((s) => s.resetDraft);
  const busy = useChamberStore((s) => s.busy);

  const vault = useMemo(
    () => vaults.find((v) => v.id === meltVaultId) ?? null,
    [vaults, meltVaultId],
  );

  const [phase, setPhase] = useState<"ready" | "melting" | "opened">("ready");

  // Once the open result arrives the ceremony reveals the released panels.
  useEffect(() => {
    if (meltResult && vault?.opened) setPhase("opened");
  }, [meltResult, vault?.opened]);

  if (!vault) {
    return (
      <section className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <p className="font-display text-lg italic text-[rgba(232,224,207,0.6)]">
          No vault is set upon the melting stone.
        </p>
        <button
          type="button"
          onClick={() => setStation("hall")}
          className="focus-ring mt-6 rounded-sm border border-[rgba(156,107,60,0.4)] px-7 py-3 font-display text-sm uppercase tracking-[0.3em] text-[#E8E0CF] hover:border-[rgba(156,107,60,0.8)]"
        >
          Return to the hall
        </button>
      </section>
    );
  }

  const trail = (evidenceByVault[vault.id] ?? []).map((e) => e.sourceLabel);
  const released = meltResult?.payloadCommitment ?? vault.payloadCommitment;

  const beginMelt = async () => {
    setPhase("melting");
    // Let the wax visibly liquefy before the reveal, unless reduced motion.
    const wait = reduced ? 200 : 2600;
    setTimeout(() => void openSeal(vault.id), wait);
  };

  const takeRubbing = () => {
    const md = `# ${vault.title}\n\n## What was sealed\n${released}\n\n## The condition that opened it\n${vault.conditionText}\n\n## The evidence the keepers agreed on\n${trail.join(" . ") || "No evidence recorded"}\n\n## Released to\n${vault.recipient}\n\n## Released at\n${absoluteTime(meltResult?.openedAt ?? vault.openedAt)}\n`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${vault.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-rubbing.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section
      className="relative flex min-h-[78vh] flex-col items-center justify-center text-center"
      aria-label="The Melt"
    >
      {/* Candle bloom that flares during the melt. */}
      <AnimatePresence>
        {phase !== "ready" && !reduced && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-0"
            style={{ background: "radial-gradient(circle at 50% 42%, rgba(224,122,60,0.22), transparent 60%)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === "opened" ? 0.5 : [0, 1, 0.7] }}
            transition={{ duration: 2.4 }}
          />
        )}
      </AnimatePresence>

      {phase !== "opened" ? (
        <div className="relative z-10 flex flex-col items-center">
          <motion.div
            animate={
              phase === "melting" && !reduced
                ? { y: [0, 6, 30], opacity: [1, 1, 0.2], scale: [1, 1.02, 0.82] }
                : {}
            }
            transition={{ duration: 2.6, ease: "easeIn" }}
          >
            <WaxSeal sigil={vault.sigil} state="releasable" size={190} melting={phase === "melting"} />
          </motion.div>

          {/* Wax drips falling during the melt. */}
          <AnimatePresence>
            {phase === "melting" && !reduced &&
              [0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="absolute rounded-b-full"
                  style={{
                    left: `${44 + i * 6}%`,
                    top: "46%",
                    width: 6,
                    background: "linear-gradient(180deg, #C0392B, #7a1c12)",
                  }}
                  initial={{ height: 4, opacity: 0 }}
                  animate={{ height: [4, 26], opacity: [0, 1, 0], y: [0, 120] }}
                  transition={{ duration: 2.2, delay: i * 0.25, ease: "easeIn" }}
                />
              ))}
          </AnimatePresence>

          <h2 className="mt-10 font-display text-2xl tracking-[0.14em] text-[#E07A3C] text-glow-gold">
            {phase === "melting" ? "The seal is melting." : "This seal is ready to melt."}
          </h2>
          <p className="mt-2 max-w-md font-display text-sm italic text-[rgba(232,224,207,0.6)]">
            {vault.conditionText}
          </p>

          {phase === "ready" && (
            <button
              type="button"
              onClick={() => void beginMelt()}
              disabled={busy}
              className="focus-ring mt-9 rounded-sm border border-[rgba(224,122,60,0.5)] bg-[rgba(34,26,18,0.6)] px-10 py-4 font-display text-sm uppercase tracking-[0.3em] text-[#E07A3C] transition-colors hover:border-[rgba(224,122,60,0.95)] disabled:opacity-40"
            >
              Let the wax melt
            </button>
          )}
        </div>
      ) : (
        // The released record: four engraved panels rising into view.
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduced ? 0.2 : 1 }}
          className="relative z-10 w-full max-w-2xl"
        >
          <h2 className="mb-8 font-display text-2xl tracking-[0.14em] text-[#F2C14E] text-glow-gold">
            The vault is open. The world caught up.
          </h2>

          <div className="flex flex-col gap-5 text-left">
            <EngravedPanel heading="What was sealed" index={0} tone="parchment">
              {released}
            </EngravedPanel>
            <EngravedPanel heading="The condition that opened it" index={1}>
              {vault.conditionText}
            </EngravedPanel>
            <EngravedPanel heading="The evidence the keepers agreed on" index={2}>
              {trail.length > 0 ? trail.join(" \u00b7 ") : "No evidence recorded"}
            </EngravedPanel>
            <EngravedPanel heading="Released to and released at" index={3}>
              <span className="block">{shortAddress(vault.recipient)}</span>
              <span className="mt-1 block text-base text-[rgba(232,224,207,0.7)]">
                {absoluteTime(meltResult?.openedAt ?? vault.openedAt)}
              </span>
            </EngravedPanel>
          </div>

          <div className="mt-9 flex flex-wrap justify-center gap-4">
            <button
              type="button"
              onClick={takeRubbing}
              className="focus-ring rounded-sm border border-[rgba(156,107,60,0.4)] px-6 py-3 font-display text-xs uppercase tracking-[0.26em] text-[#E8E0CF] hover:border-[rgba(156,107,60,0.8)]"
            >
              Keep a rubbing
            </button>
            <button
              type="button"
              onClick={() => setStation("hall")}
              className="focus-ring rounded-sm border border-[rgba(156,107,60,0.4)] px-6 py-3 font-display text-xs uppercase tracking-[0.26em] text-[#E8E0CF] hover:border-[rgba(156,107,60,0.8)]"
            >
              Return to the hall
            </button>
            <button
              type="button"
              onClick={() => {
                resetDraft();
                setDraft({ recipient: vault.recipient });
                setStation("table");
              }}
              className="focus-ring rounded-sm border border-[rgba(192,57,43,0.4)] px-6 py-3 font-display text-xs uppercase tracking-[0.26em] text-[#C0392B] hover:border-[rgba(192,57,43,0.85)]"
            >
              Seal a reply
            </button>
          </div>
        </motion.div>
      )}
    </section>
  );
}
