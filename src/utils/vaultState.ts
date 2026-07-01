import type { VaultState, ClosenessBand } from "@/lib/genlayer/types";

// Human-facing copy for each state. Never approved/rejected/verdict language.
// These read like a wax seal slowly approaching the moment it melts.
export const STATE_COPY: Record<
  VaultState,
  { label: string; whisper: string }
> = {
  sealed: { label: "Sealed", whisper: "Condition not met. Wax intact, cool light." },
  listening: { label: "Listening", whisper: "The world was checked recently." },
  nearing: { label: "Nearing", whisper: "A condition drew nearer. The wax softens." },
  releasable: { label: "Releasable", whisper: "The keepers agreed. The wax has cracked." },
  opened: { label: "Opened", whisper: "The seal melted. The keeper read." },
  dormant: { label: "Dormant", whisper: "Long untouched. Wax dull, dust settled." },
};

// Allowed forward transitions, mirrored from the contract.
const TRANSITIONS: Record<VaultState, VaultState[]> = {
  sealed: ["listening", "nearing", "releasable", "dormant"],
  listening: ["nearing", "releasable", "listening", "dormant"],
  nearing: ["releasable", "nearing", "listening", "dormant"],
  releasable: ["opened", "releasable"],
  opened: [],
  dormant: ["listening", "nearing", "releasable"],
};

export function canTransition(from: VaultState, to: VaultState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export const NEARING_THRESHOLD = 40;
export const MET_THRESHOLD = 75;

export function bandOf(closeness: number): ClosenessBand {
  if (closeness >= MET_THRESHOLD) return 2;
  if (closeness >= NEARING_THRESHOLD) return 1;
  return 0;
}

const STOPWORDS = new Set([
  "the", "this", "that", "when", "with", "from", "into", "your", "their",
  "will", "have", "has", "and", "for", "are", "was", "but", "not", "its",
  "until", "once", "been", "they", "them", "then", "than", "over", "onto",
  "a", "an", "of", "to", "is", "it", "be", "on", "in", "at", "by", "or",
  "as", "if", "so", "we", "do", "up", "out", "off", "all", "any", "can",
]);

function tokens(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length >= 4 && !STOPWORDS.has(raw)) out.push(raw);
  }
  return out;
}

// Deterministic textual overlap, mirrors the contract's _evidence_overlap. The
// real contract performs the equivalent judgment through validator consensus;
// the UI can preview a plausible reading locally in mock mode.
export function evidenceOverlap(condition: string, evidence: string): number {
  const cond = tokens(condition);
  if (cond.length === 0) return 0;
  const hay = new Set(tokens(evidence));
  const seen = new Set<string>();
  let hit = 0;
  for (const t of cond) {
    if (seen.has(t)) continue;
    seen.add(t);
    if (hay.has(t)) hit += 1;
  }
  return Math.floor((hit * 100) / seen.size);
}

export interface MockReading {
  met: boolean;
  closeness: number;
  band: ClosenessBand;
  nextState: VaultState;
  note: string;
}

// Mock keeper reading used by the mock adapter, mirroring the contract logic:
// strong overlap and explicit confirmation words -> releasable; partial trace
// -> nearing; otherwise listening.
const CONFIRM_WORDS = [
  "officially",
  "confirmed",
  "shipped",
  "released",
  "broken",
  "public",
  "listed",
  "announced",
  "completed",
  "live",
];

const SOON_WORDS = ["upcoming", "soon", "expected", "teased", "planned", "window"];

export function decideCheck(
  current: VaultState,
  condition: string,
  evidence: string,
): MockReading {
  const overlap = evidenceOverlap(condition, evidence);
  const hay = evidence.toLowerCase();
  const hasConfirm = CONFIRM_WORDS.some((w) => hay.includes(w));
  const hasSoon = SOON_WORDS.some((w) => hay.includes(w));

  // Closeness preview from overlap, lifted by confirmation language.
  let closeness = Math.min(100, overlap);
  if (hasConfirm) closeness = Math.min(100, closeness + 45);
  else if (hasSoon) closeness = Math.min(100, closeness + 18);

  const met = hasConfirm && overlap > 0 && closeness >= MET_THRESHOLD;
  const hasTrace = overlap > 0;

  let nextState: VaultState;
  if (met && closeness >= MET_THRESHOLD && hasTrace) {
    nextState = "releasable";
  } else if (closeness >= NEARING_THRESHOLD && hasTrace) {
    nextState = "nearing";
  } else {
    nextState = "listening";
  }

  let note: string;
  if (nextState === "releasable") {
    note = "The world caught up. This seal is ready to melt.";
  } else if (nextState === "nearing") {
    note = "A condition drew nearer. The wax is softening.";
  } else {
    note = "The keepers looked. Nothing confirms it yet. Held shut.";
  }

  return { met, closeness, band: bandOf(closeness), nextState, note };
}
