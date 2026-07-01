"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

interface EngravedPanelProps {
  heading: string;
  children: ReactNode;
  index?: number;
  tone?: "bronze" | "parchment";
  className?: string;
}

// A single engraved panel used in The Melt and elsewhere to present a released
// fragment. Engraved bronze rail above, content settled below. Never a card in
// a grid, always a deliberate inscribed slab that rises into view.
export function EngravedPanel({
  heading,
  children,
  index = 0,
  tone = "bronze",
  className = "",
}: EngravedPanelProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: index * 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={`${tone === "parchment" ? "parchment" : "bronze-surface"} rounded-sm px-7 py-6 ${className}`}
    >
      <div className="mb-3 flex items-center gap-3">
        <span
          className="h-px flex-1"
          style={{
            background:
              tone === "parchment"
                ? "linear-gradient(90deg, rgba(58,42,24,0.4), transparent)"
                : "linear-gradient(90deg, rgba(242,193,78,0.4), transparent)",
          }}
        />
        <h3
          className={`font-display text-xs uppercase tracking-[0.34em] ${
            tone === "parchment" ? "text-[#6b4a28]" : "text-[#9C6B3C]"
          }`}
        >
          {heading}
        </h3>
        <span
          className="h-px flex-1"
          style={{
            background:
              tone === "parchment"
                ? "linear-gradient(270deg, rgba(58,42,24,0.4), transparent)"
                : "linear-gradient(270deg, rgba(242,193,78,0.4), transparent)",
          }}
        />
      </div>
      <div
        className={`font-display text-lg leading-relaxed ${
          tone === "parchment" ? "text-[#3a2a18]" : "text-[#E8E0CF]"
        }`}
      >
        {children}
      </div>
    </motion.section>
  );
}
