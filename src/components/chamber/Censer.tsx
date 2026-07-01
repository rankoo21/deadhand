"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useChamberStore, type Station } from "@/store/useChamberStore";

// The Censer: a small swinging brass incense burner hanging in the top corner,
// trailing a thin ribbon of smoke. It replaces the classic header. On hover or
// tap the smoke spreads into engraved destinations. The active station is shown
// by which glyph glows. Each destination is a custom engraved glyph, not an icon.

const DESTINATIONS: { station: Station; label: string }[] = [
  { station: "antechamber", label: "Antechamber" },
  { station: "table", label: "Table" },
  { station: "altar", label: "Altar" },
  { station: "hall", label: "Hall" },
  { station: "ledger", label: "Ledger" },
];

function DestinationGlyph({ station, active }: { station: Station; active: boolean }) {
  const c = active ? "#F2C14E" : "rgba(232,224,207,0.55)";
  const common = {
    fill: "none",
    stroke: c,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg width={26} height={26} viewBox="0 0 32 32" aria-hidden>
      {station === "antechamber" && (
        // A closed vault door on a plinth.
        <>
          <rect x="9" y="6" width="14" height="18" rx="2" {...common} />
          <circle cx="16" cy="15" r="3.4" {...common} />
          <path d="M7 26 H25" {...common} />
        </>
      )}
      {station === "table" && (
        // A pour of wax onto parchment.
        <>
          <path d="M8 10 H24 L21 22 H11 Z" {...common} />
          <path d="M16 4 C18 7 18 9 16 10 C14 9 14 7 16 4 Z" {...common} />
        </>
      )}
      {station === "altar" && (
        // A ring of gauges around a bound seal.
        <>
          <circle cx="16" cy="16" r="9" {...common} />
          <circle cx="16" cy="16" r="3" {...common} />
          <path d="M16 7 V4 M16 28 V25 M7 16 H4 M28 16 H25" {...common} />
        </>
      )}
      {station === "hall" && (
        // A row of vaults on a shelf.
        <>
          <circle cx="10" cy="14" r="4" {...common} />
          <circle cx="22" cy="14" r="4" {...common} />
          <path d="M4 22 H28" {...common} />
        </>
      )}
      {station === "ledger" && (
        // An open ledger book.
        <>
          <path d="M16 8 C12 5 7 6 5 7 V24 C7 23 12 22 16 25 C20 22 25 23 27 24 V7 C25 6 20 5 16 8 Z" {...common} />
          <path d="M16 8 V25" {...common} />
        </>
      )}
    </svg>
  );
}

export function Censer() {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const station = useChamberStore((s) => s.station);
  const setStation = useChamberStore((s) => s.setStation);

  return (
    <div
      className="fixed right-5 top-5 z-40 flex flex-col items-end"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* The chain and swinging censer. */}
      <button
        type="button"
        className="focus-ring relative flex flex-col items-center"
        aria-label="The Censer. Open chamber destinations."
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="h-7 w-px bg-[rgba(156,107,60,0.5)]" />
        <motion.div
          style={{ transformOrigin: "top center" }}
          animate={reduced ? { rotate: 0 } : { rotate: [-7, 7, -7] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="relative"
        >
          {/* Smoke ribbon. */}
          {!reduced && (
            <motion.span
              className="absolute left-1/2 top-0 -translate-x-1/2"
              style={{
                width: 8,
                height: 30,
                background: "linear-gradient(to top, rgba(232,224,207,0.28), transparent)",
                filter: "blur(3px)",
              }}
              animate={{ opacity: [0.2, 0.5, 0.2], scaleX: [1, 1.7, 1], y: [-2, -16, -2] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeOut" }}
            />
          )}
          <svg width={40} height={44} viewBox="0 0 40 44" aria-hidden>
            <path d="M14 6 L26 6" stroke="rgba(156,107,60,0.7)" strokeWidth="1.5" />
            <path d="M14 6 L11 18 M26 6 L29 18" stroke="rgba(156,107,60,0.6)" strokeWidth="1.2" fill="none" />
            <path
              d="M9 18 Q20 16 31 18 Q33 30 20 38 Q7 30 9 18 Z"
              fill="rgba(34,26,18,0.95)"
              stroke="rgba(156,107,60,0.8)"
              strokeWidth="1.5"
            />
            <motion.circle
              cx="20"
              cy="26"
              r="4"
              fill="#E07A3C"
              animate={reduced ? { opacity: 0.8 } : { opacity: [0.5, 1, 0.6] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              style={{ filter: "drop-shadow(0 0 6px rgba(224,122,60,0.8))" }}
            />
            <path d="M12 30 Q20 34 28 30" stroke="rgba(242,193,78,0.4)" strokeWidth="1" fill="none" />
          </svg>
        </motion.div>
      </button>

      {/* The destinations the smoke spreads into. */}
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="mt-3 flex flex-col items-end gap-1 rounded-sm border border-[rgba(156,107,60,0.28)] bg-[rgba(10,8,7,0.92)] px-3 py-3 backdrop-blur-sm"
            aria-label="Chamber destinations"
          >
            {DESTINATIONS.map((d) => {
              const active = station === d.station;
              return (
                <button
                  key={d.station}
                  type="button"
                  onClick={() => {
                    setStation(d.station);
                    setOpen(false);
                  }}
                  aria-current={active ? "true" : undefined}
                  className="focus-ring group flex items-center gap-3 rounded-sm px-2 py-1.5 transition-colors hover:bg-[rgba(242,193,78,0.06)]"
                >
                  <span
                    className={`font-display text-sm tracking-[0.16em] ${
                      active ? "text-[#F2C14E] text-glow-gold" : "text-[rgba(232,224,207,0.6)]"
                    }`}
                  >
                    {d.label}
                  </span>
                  <DestinationGlyph station={d.station} active={active} />
                </button>
              );
            })}
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
}
