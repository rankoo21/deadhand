"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

interface RitualButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "wax" | "gold" | "ember" | "stone";
  ariaLabel?: string;
  className?: string;
  type?: "button" | "submit";
}

const TONE: Record<NonNullable<RitualButtonProps["tone"]>, string> = {
  wax: "border-[rgba(192,57,43,0.5)] text-[#E8E0CF] hover:border-[rgba(192,57,43,0.85)]",
  gold: "border-[rgba(242,193,78,0.45)] text-[#F2C14E] hover:border-[rgba(242,193,78,0.85)]",
  ember: "border-[rgba(224,122,60,0.5)] text-[#E07A3C] hover:border-[rgba(224,122,60,0.9)]",
  stone: "border-[rgba(110,106,99,0.4)] text-[#E8E0CF] hover:border-[rgba(156,107,60,0.7)]",
};

// A button styled as a ceremonial act, not a SaaS CTA. It reads like pressing
// a ring into wax, with a soft physical thunk on press.
export function RitualButton({
  children,
  onClick,
  disabled,
  tone = "gold",
  ariaLabel,
  className = "",
  type = "button",
}: RitualButtonProps) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className={`focus-ring relative rounded-sm border bg-[rgba(34,26,18,0.55)] px-6 py-3 font-display text-sm uppercase tracking-[0.22em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${TONE[tone]} ${className}`}
    >
      {children}
    </motion.button>
  );
}
