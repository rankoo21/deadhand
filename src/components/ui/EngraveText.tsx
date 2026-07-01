"use client";

import { ReactNode } from "react";

interface EngraveTextProps {
  children: ReactNode;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  className?: string;
}

// Text that reads as if engraved into stone or bronze. Used for wall lines and
// faint chamber lettering, never as a heavy heading.
export function EngraveText({ children, as = "p", className = "" }: EngraveTextProps) {
  const Tag = as;
  return <Tag className={`text-engrave font-display ${className}`}>{children}</Tag>;
}
