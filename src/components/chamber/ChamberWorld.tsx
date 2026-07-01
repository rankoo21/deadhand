"use client";

import { ReactNode, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useChamberStore } from "@/store/useChamberStore";
import { CandleField } from "./CandleField";
import { Censer } from "./Censer";
import { DripLine } from "./DripLine";
import { Signet } from "./Signet";

// The single candlelit chamber that holds every station. It mounts the ambient
// candle field, the Censer navigation, the Signet identity, and the Drip Line,
// then renders the active station as a spatial section. Transient notices and
// errors drift in as smoke-like lines, never as toast cards.
export function ChamberWorld({ children }: { children: ReactNode }) {
  const refresh = useChamberStore((s) => s.refresh);
  const error = useChamberStore((s) => s.error);
  const notice = useChamberStore((s) => s.notice);
  const clearMessages = useChamberStore((s) => s.clearMessages);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!error && !notice) return;
    const id = setTimeout(() => clearMessages(), 5200);
    return () => clearTimeout(id);
  }, [error, notice, clearMessages]);

  return (
    <div className="relative min-h-screen w-full">
      <CandleField />
      <Signet />
      <Censer />

      <main className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-24 pt-24">
        {children}
      </main>

      {/* Drifting chamber whispers (notice / error), like words in smoke. */}
      <AnimatePresence>
        {(error || notice) && (
          <motion.div
            key={error ?? notice ?? "msg"}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-x-0 bottom-12 z-40 flex justify-center px-6"
            role="status"
            aria-live="polite"
          >
            <p
              className={`font-display text-base italic tracking-wide ${
                error ? "text-[#E07A3C]" : "text-[rgba(242,193,78,0.85)]"
              }`}
              style={{ textShadow: "0 0 18px rgba(0,0,0,0.9)" }}
            >
              {error ?? notice}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <DripLine />
    </div>
  );
}
