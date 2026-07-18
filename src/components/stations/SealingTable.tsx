"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useChamberStore } from "@/store/useChamberStore";
import { InkInput } from "@/components/ui/InkInput";
import { Sigil, SIGIL_ORDER } from "@/components/vault/Sigil";
import { SIGIL_LABELS } from "@/utils/format";
import type { ConditionVisibility } from "@/lib/genlayer/types";

// Station 2: The Sealing Table. The user performs a sealing ritual on a stone
// table, not a form. A sheet of parchment, a stick of wax, a candle, and a
// blank sigil press. When the words are written the parchment folds and the
// wax pours. The CTA is the press itself: "Pour the wax".
export function SealingTable() {
  const reduced = useReducedMotion();
  const draft = useChamberStore((s) => s.draft);
  const setDraft = useChamberStore((s) => s.setDraft);
  const pourTheWax = useChamberStore((s) => s.pourTheWax);
  const busy = useChamberStore((s) => s.busy);

  const visibilities: { key: ConditionVisibility; label: string; hint: string }[] = [
    {
      key: "public",
      label: "Public condition",
      hint: "Validators must read the release condition in the open. The sealed message remains encrypted.",
    },
  ];

  return (
    <section className="mx-auto max-w-3xl" aria-label="The Sealing Table">
      <header className="mb-8 text-center">
        <h2 className="font-display text-2xl tracking-[0.12em] text-[#E8E0CF]">The Sealing Table</h2>
        <p className="mt-2 font-display text-sm italic text-[rgba(232,224,207,0.5)]">
          The ink remembers. Choose your sigil.
        </p>
      </header>

      {/* The parchment sheet. */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="parchment rounded-sm px-8 py-8"
      >
        <label className="mb-1 block font-display text-xs uppercase tracking-[0.3em] text-[#6b4a28]">
          The message
        </label>
        <InkInput
          ariaLabel="The secret message"
          multiline
          rows={5}
          maxLength={2000}
          value={draft.message}
          onChange={(v) => setDraft({ message: v })}
          placeholder="Write the words that must wait. The ink appears as if dipped."
        />

        <div className="mt-7 grid gap-6 sm:grid-cols-2">
          <div>
            <label className="mb-1 block font-display text-xs uppercase tracking-[0.3em] text-[#6b4a28]">
              A title for the seal
            </label>
            <InkInput
              ariaLabel="A short title for the seal"
              maxLength={140}
              value={draft.title}
              onChange={(v) => setDraft({ title: v })}
              placeholder="A few words for the plinth."
            />
          </div>
          <div>
            <label className="mb-1 block font-display text-xs uppercase tracking-[0.3em] text-[#6b4a28]">
              The recipient
            </label>
            <InkInput
              ariaLabel="The recipient address or named keeper"
              maxLength={120}
              value={draft.recipient}
              onChange={(v) => setDraft({ recipient: v })}
              placeholder="An address or a named keeper."
            />
          </div>
        </div>
      </motion.div>

      {/* The sigil press: choose a mark. */}
      <div className="mt-8">
        <p className="mb-3 text-center font-display text-xs uppercase tracking-[0.3em] text-[#9C6B3C]">
          Choose your sigil
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          {SIGIL_ORDER.map((s) => {
            const active = draft.sigil === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setDraft({ sigil: s })}
                aria-label={`Press the ${SIGIL_LABELS[s]} sigil`}
                aria-pressed={active}
                className={`focus-ring flex flex-col items-center gap-2 rounded-sm border px-4 py-3 transition-colors ${
                  active
                    ? "border-[rgba(242,193,78,0.7)] bg-[rgba(242,193,78,0.06)]"
                    : "border-[rgba(156,107,60,0.25)] hover:border-[rgba(156,107,60,0.6)]"
                }`}
              >
                <Sigil style={s} size={38} color={active ? "#F2C14E" : "rgba(232,224,207,0.7)"} />
                <span
                  className={`font-display text-[0.66rem] uppercase tracking-[0.2em] ${
                    active ? "text-[#F2C14E]" : "text-[rgba(232,224,207,0.55)]"
                  }`}
                >
                  {SIGIL_LABELS[s]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Visibility of the condition: open-faced or shrouded sigil. */}
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        {visibilities.map((v) => {
          const active = draft.conditionVisibility === v.key;
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => setDraft({ conditionVisibility: v.key })}
              aria-pressed={active}
              className={`focus-ring max-w-[16rem] rounded-sm border px-5 py-3 text-left transition-colors ${
                active
                  ? "border-[rgba(242,193,78,0.6)] bg-[rgba(242,193,78,0.05)]"
                  : "border-[rgba(156,107,60,0.25)] hover:border-[rgba(156,107,60,0.6)]"
              }`}
            >
              <span
                className={`block font-display text-sm tracking-[0.16em] ${
                  active ? "text-[#F2C14E]" : "text-[#E8E0CF]"
                }`}
              >
                {v.label}
              </span>
              <span className="mt-1 block font-display text-xs italic text-[rgba(232,224,207,0.5)]">
                {v.hint}
              </span>
            </button>
          );
        })}
      </div>

      {/* The press itself: Pour the wax. */}
      <div className="mt-10 flex flex-col items-center">
        <motion.button
          type="button"
          onClick={() => void pourTheWax()}
          disabled={busy}
          aria-label="Pour the wax over the message"
          whileTap={reduced ? undefined : { scale: 0.92 }}
          transition={{ type: "spring", stiffness: 340, damping: 18 }}
          className="focus-ring relative flex h-28 w-28 items-center justify-center rounded-full disabled:opacity-50"
          style={{
            background: "radial-gradient(circle at 38% 32%, #E06450, #7a1c12 72%)",
            boxShadow: "0 0 40px -8px rgba(192,57,43,0.7), inset 0 0 24px rgba(0,0,0,0.4)",
          }}
        >
          <Sigil style={draft.sigil} size={56} color="#2a0d0a" />
        </motion.button>
        <p className="mt-4 font-display text-sm uppercase tracking-[0.3em] text-[#C0392B]">
          Pour the wax
        </p>
      </div>
    </section>
  );
}
