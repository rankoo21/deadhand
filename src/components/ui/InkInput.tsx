"use client";

interface InkInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  ariaLabel: string;
  variant?: "ink" | "groove";
  className?: string;
  maxLength?: number;
}

// An input that reads as ink settling onto parchment, or as ink settling into a
// recessed stone groove. Never a generic boxed textarea.
export function InkInput({
  value,
  onChange,
  placeholder,
  multiline,
  rows = 4,
  ariaLabel,
  variant = "ink",
  className = "",
  maxLength,
}: InkInputProps) {
  const base =
    variant === "groove"
      ? "condition-groove w-full rounded-sm px-5 py-4 font-display text-lg leading-relaxed"
      : "ink-input w-full px-1 py-2 font-display text-lg";

  if (multiline) {
    return (
      <textarea
        aria-label={ariaLabel}
        className={`focus-ring resize-none ${base} ${className}`}
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <input
      aria-label={ariaLabel}
      className={`focus-ring ${base} ${className}`}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
