"use client";

import type { SigilStyle } from "@/lib/genlayer/types";

interface SigilProps {
  style: SigilStyle;
  size?: number;
  color?: string;
  className?: string;
}

// Custom engraved sigil marks pressed into wax or bronze. These are hand-built
// SVG glyphs, never generic icons. Each is a single pressed mark.
export function Sigil({ style, size = 48, color = "#0A0807", className = "" }: SigilProps) {
  const stroke = color;
  const common = {
    fill: "none",
    stroke,
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={`${style} sigil`}
    >
      {style === "crescent" && (
        <>
          <path d="M42 14 A20 20 0 1 0 42 50 A15 15 0 1 1 42 14 Z" {...common} />
          <circle cx="44" cy="22" r="1.6" fill={stroke} stroke="none" />
        </>
      )}
      {style === "eye" && (
        <>
          <path d="M10 32 Q32 14 54 32 Q32 50 10 32 Z" {...common} />
          <circle cx="32" cy="32" r="7" {...common} />
          <circle cx="32" cy="32" r="2" fill={stroke} stroke="none" />
        </>
      )}
      {style === "anchor" && (
        <>
          <circle cx="32" cy="14" r="5" {...common} />
          <path d="M32 19 V50" {...common} />
          <path d="M20 38 Q32 56 44 38" {...common} />
          <path d="M22 30 H42" {...common} />
        </>
      )}
      {style === "thorn" && (
        <>
          <path d="M32 8 C20 24 20 40 32 56 C44 40 44 24 32 8 Z" {...common} />
          <path d="M32 20 L24 30 M32 30 L40 40" {...common} />
        </>
      )}
      {style === "hollowStar" && (
        <path
          d="M32 8 L38 26 L57 26 L42 38 L48 56 L32 45 L16 56 L22 38 L7 26 L26 26 Z"
          {...common}
        />
      )}
      {style === "custom" && (
        <>
          <circle cx="32" cy="32" r="22" {...common} />
          <path d="M22 22 L42 42 M42 22 L22 42" {...common} />
          <circle cx="32" cy="32" r="5" {...common} />
        </>
      )}
    </svg>
  );
}

export const SIGIL_ORDER: SigilStyle[] = [
  "crescent",
  "eye",
  "anchor",
  "thorn",
  "hollowStar",
  "custom",
];
