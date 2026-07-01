"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

interface StonePanelProps {
  children: ReactNode;
  surface?: "bronze" | "stone";
  className?: string;
}

// A weighty engraved panel of bronze or stone. Used for the released record
// panels and station surfaces. Not a card.
export function StonePanel({
  children,
  surface = "stone",
  className = "",
}: StonePanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={`${surface === "bronze" ? "bronze-surface" : "stone-surface"} rounded-sm p-6 ${className}`}
    >
      {children}
    </motion.div>
  );
}
