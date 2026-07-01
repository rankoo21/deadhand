"use client";

import { motion } from "framer-motion";
import type { Vault as VaultModel } from "@/lib/genlayer/types";
import { STATE_COPY } from "@/utils/vaultState";
import { WaxSeal } from "./WaxSeal";
import { GaugeRing } from "./GaugeRing";

interface VaultProps {
  vault: VaultModel;
  active?: boolean;
  onSelect?: (id: string) => void;
  size?: number;
}

// A single bronze vault standing on its stone shelf, wrapped by a slow-turning
// gauge ring and sealed with wax. This is an object in the hall, never a card.
// State is carried by wax integrity, gauge fill, and an engraved label, never
// by color alone, for accessibility.
export function Vault({ vault, active, onSelect, size = 150 }: VaultProps) {
  const copy = STATE_COPY[vault.state];
  const spinning = vault.state === "listening" || vault.state === "nearing";
  const ariaLabel = `${vault.title}. ${copy.label}. ${copy.whisper}`;

  return (
    <motion.button
      type="button"
      onClick={() => onSelect?.(vault.id)}
      aria-label={ariaLabel}
      aria-pressed={active}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className={`focus-ring group relative flex flex-col items-center rounded-sm px-4 pb-4 pt-2 text-center ${
        active ? "bg-[rgba(242,193,78,0.06)]" : "bg-transparent"
      }`}
    >
      {/* The vault body and gauge. */}
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <GaugeRing closeness={vault.closeness} state={vault.state} size={size} spinning={spinning} />
        </div>

        {/* Bronze vault door behind the wax. */}
        <div
          className="absolute flex items-center justify-center rounded-full"
          style={{
            width: size * 0.62,
            height: size * 0.62,
            background:
              "radial-gradient(circle at 38% 32%, rgba(156,107,60,0.5), rgba(34,26,18,0.95) 72%)",
            border: "1px solid rgba(156,107,60,0.4)",
            boxShadow: "inset 0 0 28px rgba(0,0,0,0.7)",
          }}
        >
          <WaxSeal sigil={vault.sigil} state={vault.state} size={size * 0.5} />
        </div>
      </div>

      {/* Engraved plinth label. */}
      <div className="mt-3 max-w-[15rem]">
        <p className="font-display text-base leading-tight text-[#E8E0CF]">{vault.title}</p>
        <p className="mt-1 font-display text-[0.7rem] uppercase tracking-[0.28em] text-[#9C6B3C]">
          {copy.label}
        </p>
      </div>

      {active && (
        <motion.span
          layoutId="vault-select-ring"
          className="pointer-events-none absolute inset-0 rounded-sm"
          style={{ border: "1px solid rgba(242,193,78,0.35)" }}
        />
      )}
    </motion.button>
  );
}
