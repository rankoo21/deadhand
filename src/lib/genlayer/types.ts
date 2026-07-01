// Shared data models for Deadhand.
// These types are the contract between the UI, the store, and any GenLayer
// adapter (mock today, real on-chain tomorrow). Keep them stable.

export type VaultState =
  | "sealed"
  | "listening"
  | "nearing"
  | "releasable"
  | "opened"
  | "dormant";

export type SigilStyle =
  | "crescent"
  | "eye"
  | "anchor"
  | "thorn"
  | "hollowStar"
  | "custom";

export type ConditionVisibility = "public" | "private";

// Coarse closeness band agreed by validators. 0 cold, 1 warm, 2 hot.
export type ClosenessBand = 0 | 1 | 2;

export interface Vault {
  id: string;
  owner: string;
  recipient: string;
  sigil: SigilStyle;
  title: string;
  // The committed reference to the sealed payload. Held shut (empty string)
  // until the vault is opened, exactly as the contract returns it.
  payloadCommitment: string;
  conditionText: string;
  conditionVisibility: ConditionVisibility;
  conditionBound: boolean;
  conditionShrouded: boolean;
  state: VaultState;
  sealedAt: number;
  lastCheckedAt: number | null;
  openedAt: number | null;
  closeness: number; // 0..100
  closenessBand: ClosenessBand;
  opened: boolean;
}

export interface Evidence {
  id: string;
  vaultId: string;
  sourceLabel: string;
  snapshot: string;
  checkedAt: number;
}

export interface LedgerEntry {
  id: string;
  vaultId: string;
  title: string;
  conditionText: string;
  recipient: string;
  evidenceTrail: string;
  sealedAt: number;
  openedAt: number;
  mockTxHash: string;
  state: VaultState;
}

// Result of a world-check, describing the state transition and the keepers'
// agreed reading of the evidence.
export interface CheckResult {
  vaultId: string;
  previousState: VaultState;
  nextState: VaultState;
  met: boolean;
  closeness: number;
  closenessBand: ClosenessBand;
  evidenceId: string;
  note: string;
}

// Result of opening a releasable vault. Reveals the payload reference once.
export interface OpenResult {
  vaultId: string;
  ledgerId: string;
  payloadCommitment: string;
  openedAt: number;
  note: string;
}

export interface SealInput {
  owner: string;
  title: string;
  payloadCommitment: string;
  recipient: string;
  sigil: SigilStyle;
  conditionVisibility: ConditionVisibility;
}

export interface CheckWorldInput {
  vaultId: string;
  evidence: string;
  sourceLabel: string;
}

// The adapter interface. mockAdapter and contractAdapter both implement this so
// the UI never knows or cares which one is live.
export interface DeadhandAdapter {
  readonly mode: "mock" | "contract";
  // Address of the active identity (the signet). This is the connected browser
  // wallet in contract mode, or a synthetic address in mock mode. It is null
  // when no wallet is connected.
  getIdentityAddress(): string | null;
  // Optional browser-wallet support (contract mode only).
  hasInjectedWallet?(): boolean;
  connectWallet?(): Promise<string>;
  disconnectWallet?(): void;
  isUsingWallet?(): boolean;

  seal(input: SealInput): Promise<Vault>;
  bindCondition(vaultId: string, conditionText: string): Promise<Vault>;
  checkWorld(input: CheckWorldInput): Promise<CheckResult>;
  openSeal(vaultId: string): Promise<OpenResult>;
  entrust(vaultId: string, newRecipient: string): Promise<Vault>;

  getVault(vaultId: string): Promise<Vault | null>;
  getVaults(): Promise<Vault[]>;
  getEvidence(vaultId: string): Promise<Evidence[]>;
  getLedger(): Promise<LedgerEntry[]>;
}
