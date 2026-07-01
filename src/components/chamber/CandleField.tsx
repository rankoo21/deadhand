"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";

// Faint dust motes drifting in the candle glow, plus a few candle flames whose
// flicker drives the ambient light. Reduced motion freezes the flicker and
// stills the dust, as the concept requires. Purely atmospheric, aria-hidden.
export function CandleField() {
  const reduced = useReducedMotion();

  const motes = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 1 + Math.random() * 2.4,
        delay: Math.random() * 8,
        duration: 12 + Math.random() * 12,
      })),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {/* A breathing candle glow that lightly pulses the chamber. */}
      <motion.div
        className="absolute left-[18%] top-[12%] h-[40rem] w-[40rem] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(242,193,78,0.10), transparent 62%)",
        }}
        animate={reduced ? { opacity: 0.7 } : { opacity: [0.55, 0.9, 0.6], scale: [1, 1.04, 1] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-[12%] top-[28%] h-[34rem] w-[34rem] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(224,122,60,0.07), transparent 64%)",
        }}
        animate={reduced ? { opacity: 0.6 } : { opacity: [0.4, 0.75, 0.45], scale: [1, 1.05, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      {motes.map((m) => (
        <motion.span
          key={m.id}
          className="absolute rounded-full"
          style={{
            left: `${m.left}%`,
            top: `${m.top}%`,
            width: m.size,
            height: m.size,
            background: "rgba(232,224,207,0.6)",
            filter: "blur(0.4px)",
          }}
          animate={
            reduced
              ? { opacity: 0.18 }
              : { y: [0, -34, 0], x: [0, 12, 0], opacity: [0.08, 0.32, 0.08] }
          }
          transition={{ duration: m.duration, delay: m.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}

      {/* Soft vignette pulling edges into shadow. */}
      <div
        className="absolute inset-0"
        style={{ boxShadow: "inset 0 0 220px 60px rgba(0,0,0,0.7)" }}
      />
    </div>
  );
}
