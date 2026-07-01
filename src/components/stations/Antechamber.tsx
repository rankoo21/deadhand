"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useChamberStore } from "@/store/useChamberStore";
import { WaxSeal } from "@/components/vault/WaxSeal";
import { SMOKE_HINTS } from "@/data/mockConditions";

// Station 1: The Antechamber. The entry experience, replacing a landing page.
// A single closed bronze vault sits on a plinth, sealed with red wax. The only
// affordance is to approach the vault, which slides a drawer from the plinth
// labeled "Press a new seal", pulling the user to the Sealing Table.
export function Antechamber() {
  const reduced = useReducedMotion();
  const [approached, setApproached] = useState(false);
  const setStation = useChamberStore((s) => s.setStation);

  return (
    <section
      className="flex min-h-[72vh] flex-col items-center justify-center text-center"
      aria-label="The Antechamber"
    >
      {/* Faint wall lettering. */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ duration: 2 }}
        className="mb-10 max-w-md font-display text-sm italic leading-relaxed text-[rgba(232,224,207,0.5)]"
      >
        Press a seal. Bind it to a condition. Let the world decide when it opens.
      </motion.p>

      {/* The vault on its plinth. */}
      <motion.button
        type="button"
        onClick={() => setApproached(true)}
        onMouseEnter={() => setApproached(true)}
        aria-label="Approach the sealed vault"
        className="focus-ring group relative flex flex-col items-center"
        whileHover={{ scale: 1.01 }}
      >
        {/* Engraved seal text encircling the wax. */}
        <div className="relative flex flex-col items-center">
          <motion.div
            animate={reduced ? {} : { y: [0, -4, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            className="relative"
          >
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 230,
                height: 230,
                background:
                  "radial-gradient(circle at 38% 30%, rgba(156,107,60,0.42), rgba(34,26,18,0.96) 72%)",
                border: "1px solid rgba(156,107,60,0.4)",
                boxShadow: "inset 0 0 50px rgba(0,0,0,0.75), 0 40px 70px -40px rgba(0,0,0,0.9)",
              }}
            >
              <WaxSeal sigil="custom" state="sealed" size={150} />
            </div>
          </motion.div>

          <h1 className="mt-9 max-w-lg font-display text-3xl font-medium leading-snug text-[#E8E0CF] text-glow-gold sm:text-4xl">
            Some words should wait for the world.
          </h1>
        </div>

        {/* The plinth. */}
        <div
          className="mt-8 h-5 w-72 rounded-sm"
          style={{
            background: "linear-gradient(180deg, rgba(110,106,99,0.3), rgba(10,8,7,0.9))",
            borderTop: "1px solid rgba(156,107,60,0.3)",
          }}
        />

        {/* The drawer sliding out on approach. */}
        <AnimatePresence>
          {approached && (
            <motion.div
              initial={{ height: 0, opacity: 0, y: -6 }}
              animate={{ height: "auto", opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div
                role="link"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setStation("table");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setStation("table");
                }}
                className="focus-ring mt-3 cursor-pointer rounded-sm border border-[rgba(192,57,43,0.4)] bg-[rgba(34,26,18,0.7)] px-8 py-3 font-display text-sm uppercase tracking-[0.3em] text-[#E8E0CF] transition-colors hover:border-[rgba(192,57,43,0.85)]"
              >
                Press a new seal
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* A single drifting smoke hint. */}
      <motion.p
        animate={reduced ? { opacity: 0.4 } : { opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 6, repeat: Infinity }}
        className="mt-14 font-display text-xs uppercase tracking-[0.34em] text-[rgba(156,107,60,0.8)]"
      >
        {SMOKE_HINTS[0]}
      </motion.p>
    </section>
  );
}
