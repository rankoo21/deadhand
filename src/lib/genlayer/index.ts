import { ContractAdapter } from "./contractAdapter";
import { MockAdapter } from "./mockAdapter";

export type TestLensAdapter = ContractAdapter | MockAdapter;
let cached: TestLensAdapter | null = null;

export function getAdapter(): TestLensAdapter {
  if (cached) return cached;
  const mode = process.env.NEXT_PUBLIC_TESTLENS_MODE ?? "preview";
  const contractAddress = process.env.NEXT_PUBLIC_TESTLENS_CONTRACT ?? "";
  const network = process.env.NEXT_PUBLIC_TESTLENS_NETWORK ?? "studionet";
  cached = mode === "contract" && contractAddress
    ? new ContractAdapter({ contractAddress, network })
    : new MockAdapter();
  return cached;
}

export * from "./types";
