"use client";

import { motion } from "framer-motion";
import type { SigilStyle, VaultState } from "@/lib/genlayer/types";
import { Sigil } from "./Sigil";

interface WaxSealProps {
  sigil: SigilStyle;
  state: VaultState;
  size?: number;
  melting?: boolean;
}

// A blob of pressed sealing wax holding a sigil. Wax red is reserved for active
// unmelted seals; nearing wax glistens, releasable wax cracks, opened wax is a
// dull bronze scar. Reduced motion freezes the flicker.
export function WaxSeal({ sigil, state, size = 96, melting }: WaxSealProps) {
  const isActive = state === "sealed" || state === "listening" || state === "dormant";
  const isNearing = state === "nearing";
  const isReleasable = state === "releasable";
  const isOpened = state === "opened";

  const waxFill = isOpened
    ? "#5b4326"
    : isReleasable
      ? "#9C2A1F"
      : isNearing
        ? "#B33326"
        : state === "dormant"
          ? "#6e2a22"
          : "#C0392B";

  const sigilColor = isOpened ? "#3a2a18" : "#2a0d0a";

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* Glow under active wax. */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            isReleasable || melting
              ? "radial-gradient(circle, rgba(224,122,60,0.55), transparent 68%)"
              : isNearing
                ? "radial-gradient(circle, rgba(242,193,78,0.32), transparent 70%)"
                : "radial-gradient(circle, rgba(192,57,43,0.28), transparent 72%)",
        }}
        animate={
          isActive || isNearing
            ? { opacity: [0.55, 1, 0.7], scale: [1, 1.05, 1] }
            : { opacity: 0.8 }
        }
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* The wax blob: an irregular pressed circle. */}
      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        animate={
          melting
            ? { scale: [1, 1.04, 0.9], rotate: [0, 1.5, -2] }
            : isNearing
              ? { scale: [1, 1.02, 1] }
              : {}
        }
        transition={{ duration: melting ? 2.6 : 6, repeat: melting ? 0 : Infinity, ease: "easeInOut" }}
      >
        <defs>
          <radialGradient id={`wax-${state}`} cx="38%" cy="34%" r="70%">
            <stop offset="0%" stopColor={isOpened ? "#745530" : "#E06450"} />
            <stop offset="60%" stopColor={waxFill} />
            <stop offset="100%" stopColor={isOpened ? "#3a2a18" : "#6b1810"} />
          </radialGradient>
        </defs>
        <path
          d="M50 6 C66 6 78 14 84 30 C92 40 92 58 84 70 C80 86 64 94 50 94 C34 94 20 86 15 70 C8 58 8 40 16 30 C22 14 34 6 50 6 Z"
          fill={`url(#wax-${state})`}
          stroke={isReleasable ? "#E07A3C" : "rgba(0,0,0,0.4)"}
          strokeWidth="1.5"
        />
        {/* Crack lines appear when releasable. */}
        {isReleasable && (
          <g stroke="#2a0d0a" strokeWidth="1.2" fill="none" opacity="0.7">
            <path d="M50 10 L46 34 L54 50 L48 70" />
            <path d="M30 28 L44 40" />
            <path d="M70 32 L56 46" />
          </g>
        )}
      </motion.svg>

      {/* Pressed sigil at the center. */}
      <div className="absolute">
        <Sigil style={sigil} size={size * 0.46} color={sigilColor} />
      </div>
    </div>
  );
}
