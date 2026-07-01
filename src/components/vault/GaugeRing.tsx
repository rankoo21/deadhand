"use client";

import { motion } from "framer-motion";
import type { VaultState } from "@/lib/genlayer/types";

interface GaugeRingProps {
  closeness: number; // 0..100
  state: VaultState;
  size?: number;
  spinning?: boolean;
}

// A slow-turning brass gauge ring around a sealed vault, showing how near the
// condition is. The arc fills with candlelight as closeness rises. Not a chart.
export function GaugeRing({ closeness, state, size = 132, spinning }: GaugeRingProps) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, closeness)) / 100;
  const arc = c * pct;

  const arcColor =
    state === "releasable"
      ? "#E07A3C"
      : state === "nearing"
        ? "#F2C14E"
        : state === "opened"
          ? "#9C6B3C"
          : "#6E6A63";

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="overflow-visible"
      role="img"
      aria-label={`Condition closeness ${Math.round(closeness)} percent`}
    >
      {/* Engraved tick ring, slow turning. */}
      <motion.g
        style={{ transformOrigin: "center" }}
        animate={spinning ? { rotate: 360 } : { rotate: 0 }}
        transition={spinning ? { duration: 60, ease: "linear", repeat: Infinity } : {}}
      >
        {Array.from({ length: 48 }).map((_, i) => {
          const a = (i / 48) * Math.PI * 2;
          const inner = r - (i % 4 === 0 ? 7 : 3);
          const x1 = size / 2 + Math.cos(a) * inner;
          const y1 = size / 2 + Math.sin(a) * inner;
          const x2 = size / 2 + Math.cos(a) * r;
          const y2 = size / 2 + Math.sin(a) * r;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(156,107,60,0.4)"
              strokeWidth={i % 4 === 0 ? 1.4 : 0.7}
            />
          );
        })}
      </motion.g>

      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(110,106,99,0.25)"
        strokeWidth={4}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={arcColor}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={`${arc} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        initial={false}
        animate={{ strokeDasharray: `${arc} ${c}` }}
        transition={{ duration: 1.1, ease: "easeInOut" }}
        style={{ filter: `drop-shadow(0 0 6px ${arcColor}88)` }}
      />
    </svg>
  );
}
