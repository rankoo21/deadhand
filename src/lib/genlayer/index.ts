import type { DeadhandAdapter } from "./types";
import { MockAdapter } from "./mockAdapter";
import { ContractAdapter } from "./contractAdapter";

// Single place that decides which adapter is live. The UI imports getAdapter()
// and never imports a concrete adapter directly.
let cached: DeadhandAdapter | null = null;

export function getAdapter(): DeadhandAdapter {
  if (cached) return cached;

  const mode = process.env.NEXT_PUBLIC_DEADHAND_MODE ?? "mock";
  const contractAddress = process.env.NEXT_PUBLIC_DEADHAND_CONTRACT ?? "";
  const network = process.env.NEXT_PUBLIC_DEADHAND_NETWORK ?? "studionet";

  if (mode === "contract" && contractAddress) {
    cached = new ContractAdapter({ contractAddress, network });
  } else {
    cached = new MockAdapter();
  }
  return cached;
}

export * from "./types";
