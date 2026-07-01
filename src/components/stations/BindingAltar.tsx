"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useChamberStore } from "@/store/useChamberStore";
import { InkInput } from "@/components/ui/InkInput";
import { GaugeRing } from "@/components/vault/GaugeRing";
import { WaxSeal } from "@/components/vault/WaxSeal";
import { CONDITION_PLACEHOLDERS, CONDITION_HINTS } from "@/data/mockConditions";

// Station 3: The Binding Altar. The user binds the immutable natural-language
// condition that will open the seal. A raised altar with a ring of slow-turning
// brass gauges around the sealed bundle. The condition is written into a
// recessed groove in the stone, glowing faintly, never a plain textarea.
export function BindingAltar() {
  const reduced = useReducedMotion();
  const [condition, setCondition] = useState("");
  const bindCondition = useChamberStore((s) => s.bindCondition);
  const busy = useChamberStore((s) => s.busy);
  const draft = useChamberStore((s) => s.draft);
  const vaults = useChamberStore((s) => s.vaults);
  const draftVaultId = useChamberStore((s) => s.draftVaultId);
  const activeVaultId = useChamberStore((s) => s.activeVaultId);

  const boundVault = vaults.find((v) => v.id === (draftVaultId ?? activeVaultId));
  const sigil = boundVault?.sigil ?? draft.sigil;

  const placeholder =
    CONDITION_PLACEHOLDERS[Math.floor((condition.length / 7) % CONDITION_PLACEHOLDERS.length)] ??
    CONDITION_PLACEHOLDERS[0];

  return (
    <section className="mx-auto max-w-3xl text-center" aria-label="The Binding Altar">
      <header className="mb-8">
        <h2 className="font-display text-2xl tracking-[0.12em] text-[#E8E0CF]">The Binding Altar</h2>
        <p className="mt-2 font-display text-sm italic text-[rgba(232,224,207,0.5)]">
          Write what the world can confirm. Once bound, it cannot change.
        </p>
      </header>

      {/* The sealed bundle ringed by slow-turning gauges. */}
      <div className="relative mx-auto mb-10 flex h-56 w-56 items-center justify-center">
        <div className="absolute inset-0 flex items-center justify-center">
          <GaugeRing closeness={18} state="sealed" size={224} spinning />
        </div>
        <motion.div
          animate={reduced ? {} : { rotate: [-2, 2, -2] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        >
          <WaxSeal sigil={sigil} state="sealed" size={120} />
        </motion.div>
      </div>

      {/* The recessed condition groove. */}
      <div className="mx-auto max-w-2xl">
        <InkInput
          ariaLabel="The condition that will open the seal"
          variant="groove"
          multiline
          rows={3}
          maxLength={600}
          value={condition}
          onChange={setCondition}
          placeholder={placeholder}
        />
      </div>

      {/* Engraved guidance. */}
      <ul className="mx-auto mt-6 flex max-w-xl flex-col gap-1.5">
        {CONDITION_HINTS.map((h) => (
          <li
            key={h}
            className="font-display text-xs uppercase tracking-[0.22em] text-[rgba(156,107,60,0.8)]"
          >
            {h}
          </li>
        ))}
      </ul>

      {/* The ritual binding. */}
      <div className="mt-9">
        <motion.button
          type="button"
          onClick={() => void bindCondition(condition)}
          disabled={busy || !condition.trim()}
          aria-label="Bind the condition to the seal"
          whileTap={reduced ? undefined : { scale: 0.95 }}
          className="focus-ring rounded-sm border border-[rgba(242,193,78,0.5)] bg-[rgba(34,26,18,0.6)] px-10 py-4 font-display text-sm uppercase tracking-[0.3em] text-[#F2C14E] transition-colors hover:border-[rgba(242,193,78,0.9)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Bind the condition
        </motion.button>
      </div>
    </section>
  );
}
