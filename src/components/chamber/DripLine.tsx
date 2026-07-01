"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

// The Drip Line: a thin line of cooling wax along the bottom of the viewport
// that occasionally drips and reforms. It replaces the classic footer. Engraved
// text rests inside the bronze rail. When the user interacts heavily it stills;
// when idle a slow drip forms and falls.
export function DripLine() {
  const reduced = useReducedMotion();
  const [idle, setIdle] = useState(true);
  const [dripKey, setDripKey] = useState(0);

  // Track heavy interaction: any input/scroll stills the line briefly.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const markBusy = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), 2600);
    };
    window.addEventListener("pointermove", markBusy, { passive: true });
    window.addEventListener("scroll", markBusy, { passive: true });
    window.addEventListener("keydown", markBusy);
    return () => {
      window.removeEventListener("pointermove", markBusy);
      window.removeEventListener("scroll", markBusy);
      window.removeEventListener("keydown", markBusy);
      clearTimeout(timer);
    };
  }, []);

  // While idle, periodically form a new drip.
  useEffect(() => {
    if (reduced || !idle) return;
    const id = setInterval(() => setDripKey((k) => k + 1), 5200);
    return () => clearInterval(id);
  }, [idle, reduced]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30" aria-hidden>
      {/* The cooling wax ledge. */}
      <div className="relative h-7 w-full">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, transparent, rgba(34,26,18,0.6) 40%, rgba(10,8,7,0.95))",
            borderTop: "1px solid rgba(156,107,60,0.3)",
          }}
        />
        {/* A faint wax bead riding the rail. */}
        <div
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(192,57,43,0.5) 30%, rgba(160,40,30,0.6) 50%, rgba(192,57,43,0.5) 70%, transparent)",
          }}
        />

        {/* Engraved rail text. */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-[0.66rem] uppercase tracking-[0.42em] text-[rgba(156,107,60,0.7)]">
            GenLayer . Deadhand . Sealed by consensus . Testnet
          </span>
        </div>

        {/* A slow drip forming and falling when idle. */}
        <AnimatePresence>
          {!reduced && idle && (
            <motion.span
              key={dripKey}
              className="absolute left-[26%] top-[3px] rounded-b-full"
              style={{ width: 5, background: "linear-gradient(180deg, #C0392B, #7a1c12)" }}
              initial={{ height: 2, opacity: 0 }}
              animate={{ height: [2, 12, 12], opacity: [0, 1, 0], y: [0, 0, 20] }}
              transition={{ duration: 4.4, ease: "easeIn", times: [0, 0.5, 1] }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
