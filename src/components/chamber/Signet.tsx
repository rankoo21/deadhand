"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useChamberStore } from "@/store/useChamberStore";

// The Signet: a living wallet object, never a rectangular button. Before
// connection it is a cold unlit signet ring on a stone ledge reading "Take up
// the signet." After connection the ring warms with candlelight and shows a
// shortened address only on hover.
export function Signet() {
  const reduced = useReducedMotion();
  const [hover, setHover] = useState(false);
  const signetAddress = useChamberStore((s) => s.signetAddress);
  const signetLabel = useChamberStore((s) => s.signetLabel);
  const takeUpSignet = useChamberStore((s) => s.takeUpSignet);
  const setDownSignet = useChamberStore((s) => s.setDownSignet);
  const busy = useChamberStore((s) => s.busy);

  const connected = Boolean(signetAddress);

  return (
    <div
      className="fixed left-5 top-5 z-40 flex items-center gap-3"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        disabled={busy}
        onClick={() => (connected ? setDownSignet() : void takeUpSignet())}
        aria-label={
          connected
            ? `The signet is taken up. Identity ${signetLabel}. Set it down.`
            : "Take up the signet to begin."
        }
        className="focus-ring flex items-center gap-3 rounded-sm px-2 py-1.5"
      >
        {/* The ring resting on a small stone ledge. */}
        <span className="relative flex flex-col items-center">
          <svg width={38} height={38} viewBox="0 0 40 40" aria-hidden>
            {/* Stone ledge. */}
            <path d="M6 33 H34" stroke="rgba(110,106,99,0.5)" strokeWidth="2" strokeLinecap="round" />
            {/* The ring band. */}
            <motion.ellipse
              cx="20"
              cy="20"
              rx="9"
              ry="12"
              fill="none"
              stroke={connected ? "#F2C14E" : "rgba(110,106,99,0.7)"}
              strokeWidth="3"
              animate={
                connected && !reduced
                  ? { opacity: [0.7, 1, 0.8] }
                  : { opacity: connected ? 0.9 : 0.6 }
              }
              transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
              style={connected ? { filter: "drop-shadow(0 0 6px rgba(242,193,78,0.7))" } : undefined}
            />
            {/* The engraved face. */}
            <circle
              cx="20"
              cy="11"
              r="5.5"
              fill={connected ? "#9C6B3C" : "rgba(34,26,18,0.9)"}
              stroke={connected ? "#F2C14E" : "rgba(110,106,99,0.7)"}
              strokeWidth="1.5"
            />
            <path
              d="M17.5 11 L22.5 11 M20 8.5 L20 13.5"
              stroke={connected ? "#0A0807" : "rgba(110,106,99,0.6)"}
              strokeWidth="1.2"
            />
          </svg>
        </span>

        <span className="flex flex-col items-start leading-tight">
          <span
            className={`font-display text-sm tracking-[0.16em] ${
              connected ? "text-[#F2C14E]" : "text-[rgba(232,224,207,0.62)]"
            }`}
          >
            {connected ? "The signet is warm" : "Take up the signet"}
          </span>
          {connected && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: hover ? 1 : 0 }}
              className="font-display text-[0.7rem] tracking-[0.2em] text-[rgba(156,107,60,0.9)]"
            >
              {signetLabel}
            </motion.span>
          )}
        </span>
      </button>
    </div>
  );
}
