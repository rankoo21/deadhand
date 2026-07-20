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
  const progress = useChamberStore((s) => s.progress);
  const clearMessages = useChamberStore((s) => s.clearMessages);

  const EXPLORER_TX = "https://explorer-bradbury.genlayer.com/tx/";

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

      {/* Persistent progress banner while a slow on-chain write is in flight. */}
      <AnimatePresence>
        {progress && (
          <motion.div
            key="progress"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-x-0 top-0 z-50 flex justify-center px-6 pt-3"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-3 rounded-b-md border border-[rgba(242,193,78,0.35)] bg-[rgba(20,15,10,0.92)] px-5 py-3 backdrop-blur-sm">
              <span
                className="h-3 w-3 flex-none animate-pulse rounded-full"
                style={{ background: "#F2C14E", boxShadow: "0 0 12px rgba(242,193,78,0.8)" }}
              />
              <div className="flex flex-col">
                <span className="font-display text-sm tracking-wide text-[rgba(242,193,78,0.95)]">
                  {progress.label}
                </span>
                {progress.txHash && (
                  <a
                    href={EXPLORER_TX + progress.txHash}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-display text-xs tracking-wide text-[rgba(199,205,212,0.7)] underline underline-offset-2 hover:text-[rgba(242,193,78,0.9)]"
                  >
                    View transaction on the explorer
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
