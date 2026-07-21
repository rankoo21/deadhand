import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { studionet, testnetBradbury, localnet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import type {
  CheckResult,
  CheckWorldInput,
  ClosenessBand,
  DeadhandAdapter,
  Evidence,
  LedgerEntry,
  OpenResult,
  SealInput,
  Vault,
  VaultState,
} from "./types";

// Real GenLayer adapter. Implements the exact same DeadhandAdapter interface as
// the mock, so swapping it in does not touch a single line of UI code.
//
// To go live:
//   1. Deploy contracts/DeadhandContract.py (see scripts/deploy.mjs).
//   2. Set NEXT_PUBLIC_DEADHAND_MODE=contract and NEXT_PUBLIC_DEADHAND_CONTRACT=0x...
//   3. Optionally set NEXT_PUBLIC_DEADHAND_NETWORK (studionet | bradbury | localnet).
//
// Wallet model: every visitor brings their own browser wallet (MetaMask with
// the GenLayer Snap) to WRITE. That connected wallet is the only signet for
// writes. Reads use a client that always carries an unfunded burner account
// (persisted in localStorage, or a fresh ephemeral account when storage is
// unavailable) because genlayer-js refuses any contract call without an account
// attached. The read burner is never used to sign a write. The deploy key in
// .env.deploy is server-side only.

type AnyClient = ReturnType<typeof createClient>;

const ACCEPTED = TransactionStatus.ACCEPTED;
const NO_SIGNET_MESSAGE = "Take up the signet to do this.";

export interface ContractAdapterConfig {
  contractAddress: string;
  network?: string;
}

function pickChain(network?: string) {
  switch ((network ?? "studionet").toLowerCase()) {
    case "bradbury":
    case "testnet-bradbury":
    case "testnetbradbury":
      return testnetBradbury;
    case "localnet":
      return localnet;
    case "studionet":
    default:
      return studionet;
  }
}

function networkName(network?: string): "studionet" | "testnetBradbury" | "localnet" {
  switch ((network ?? "studionet").toLowerCase()) {
    case "bradbury":
    case "testnet-bradbury":
    case "testnetbradbury":
      return "testnetBradbury";
    case "localnet":
      return "localnet";
    default:
      return "studionet";
  }
}

// Recursively turn Maps (genlayer calldata) into plain objects so the UI can
// read fields with dot access regardless of how the value was decoded.
function toPlain(value: unknown): any {
  if (value instanceof Map) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of value.entries()) obj[String(k)] = toPlain(v);
    return obj;
  }
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === "bigint") return Number(value);
  return value;
}

export class ContractAdapter implements DeadhandAdapter {
  readonly mode = "contract" as const;
  private readonly config: ContractAdapterConfig;
  private readonly chain: ReturnType<typeof pickChain>;
  private client: AnyClient | null = null;
  private walletAddress: string | null = null;
  private usingWallet = false;
  private readAccount: ReturnType<typeof createAccount> | null = null;

  constructor(config: ContractAdapterConfig) {
    this.config = config;
    this.chain = pickChain(config.network);
  }

  // -- identity (the signet) ------------------------------------------

  // A per-session ephemeral account satisfies genlayer-js read calls. It is
  // never persisted, funded, or used for writes.
  private ensureReadAccount(): ReturnType<typeof createAccount> {
    if (!this.readAccount) this.readAccount = createAccount(generatePrivateKey());
    return this.readAccount;
  }

  // A read client that ALWAYS has an account. Used for every view call so the
  // chamber can be viewed with no wallet connected, without triggering the
  // "No account set" error. Once a wallet connects, connectWallet replaces
  // this.client with the wallet-backed client.
  private getReadClient(): AnyClient {
    if (this.client) return this.client;
    this.client = createClient({ chain: this.chain, account: this.ensureReadAccount() });
    return this.client;
  }

  // The client used for writes. Requires a connected wallet.
  private getWriteClient(): AnyClient {
    if (!this.usingWallet || !this.client) {
      throw new Error(NO_SIGNET_MESSAGE);
    }
    return this.client;
  }

  hasInjectedWallet(): boolean {
    return typeof window !== "undefined" && Boolean((window as any).ethereum);
  }

  async connectWallet(): Promise<string> {
    if (typeof window === "undefined") {
      throw new Error("Wallet connect is only available in the browser.");
    }
    const eth = (window as any).ethereum;
    if (!eth) {
      throw new Error(
        "No browser wallet found. Install MetaMask (with the GenLayer Snap) to take up the signet.",
      );
    }
    // 1. Unlock MetaMask and get the selected address FIRST.
    let addr: string | undefined;
    try {
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      addr = accounts?.[0] ? String(accounts[0]) : undefined;
    } catch (e: any) {
      if (e?.code === 4001) throw new Error("Wallet connection was rejected.");
      throw new Error("Could not reach MetaMask. Unlock it and try again.");
    }
    if (!addr) throw new Error("MetaMask returned no account. Unlock it and try again.");

    // 2. Create the client WITH the account address up front. genlayer-js
    //    validates client.account on every write ("No account set" otherwise),
    //    and setting it after construction does not take, so it must be passed
    //    to createClient here. Signing still routes through the GenLayer Snap.
    const client = createClient({
      chain: this.chain,
      account: addr as `0x${string}`,
    }) as AnyClient;

    // 3. Activate the GenLayer Snap and switch the network.
    try {
      await client.connect(networkName(this.config.network));
    } catch (e: any) {
      if (e?.code === 4001) throw new Error("The GenLayer Snap connection was rejected in MetaMask.");
      const detail = String(e?.message ?? e).slice(0, 200);
      throw new Error(
        "Could not activate the GenLayer Snap in MetaMask. Make sure MetaMask is unlocked and allows Snaps, then approve the install. Details: " +
          detail,
      );
    }

    this.client = client;
    this.walletAddress = addr;
    this.usingWallet = true;
    return addr;
  }

  disconnectWallet(): void {
    this.client = null;
    this.walletAddress = null;
    this.usingWallet = false;
  }

  isUsingWallet(): boolean {
    return this.usingWallet;
  }

  get ownerAddress(): string | null {
    return this.usingWallet ? this.walletAddress : null;
  }

  getIdentityAddress(): string | null {
    return this.ownerAddress;
  }

  private get address(): `0x${string}` {
    return this.config.contractAddress as `0x${string}`;
  }

  // -- low level -------------------------------------------------------

  private async read<T>(functionName: string, args: unknown[] = []): Promise<T> {
    const client = this.getReadClient();
    const raw = await client.readContract({
      address: this.address,
      functionName,
      args: args as any,
    });
    return toPlain(raw) as T;
  }

  // Optional progress hook. The store sets this so the UI can show live phases
  // of a slow Bradbury write (submitting -> waiting for consensus -> accepted)
  // instead of a silent spinner. Never throws; failures are ignored.
  onPhase: ((phase: string, detail?: string) => void) | null = null;

  private emit(phase: string, detail?: string): void {
    try {
      this.onPhase?.(phase, detail);
    } catch {
      /* progress reporting must never break a write */
    }
  }

  private async writeReceipt(functionName: string, args: unknown[]): Promise<any> {
    const client = this.getWriteClient();
    this.emit("submitting", "Waiting for you to sign in MetaMask.");
    const hash = await client.writeContract({
      address: this.address,
      functionName,
      args: args as any,
      value: 0n,
    });
    this.emit("submitted", hash);

    // Once a hash exists, never submit the write again. Consensus can outlive a
    // client polling window; resubmitting a non-idempotent seal would create a
    // second vault if both transactions are eventually accepted.
    let lastErr: unknown;
    for (let pollingWindow = 0; pollingWindow < 3; pollingWindow++) {
      try {
        const receipt = await client.waitForTransactionReceipt({
          hash,
          status: ACCEPTED,
          interval: 6000,
          retries: 150,
        });
        this.emit("accepted", hash);
        return receipt;
      } catch (e) {
        lastErr = e;
        const msg = String((e as Error)?.message ?? e);
        if (!/timed out|temporarily|timeout|429/i.test(msg)) throw e;
        if (pollingWindow < 2) {
          this.emit("polling", hash);
          await new Promise((resolve) => setTimeout(resolve, 8000));
        }
      }
    }
    throw new Error(
      `Transaction ${hash} is still pending. It was not resubmitted. Check the explorer before trying this action again. ${String((lastErr as Error)?.message ?? "")}`.trim(),
    );
  }

  private extractReturn<T>(receipt: any): T | undefined {
    if (!receipt) return undefined;
    const candidates = [
      receipt?.consensus_data?.leader_receipt?.[0]?.result,
      receipt?.consensus_data?.leader_receipt?.result,
      receipt?.result,
      receipt?.returnValue,
      receipt?.data,
    ];
    for (const c of candidates) {
      if (c !== undefined && c !== null) return toPlain(c) as T;
    }
    return undefined;
  }

  // -- writes ----------------------------------------------------------

  async seal(input: SealInput): Promise<Vault> {
    // Snapshot existing ids before submitting so receipt fallbacks can identify
    // this exact seal instead of returning an older vault owned by the signer.
    const before = await this.getVaults().catch(() => [] as Vault[]);
    const knownIds = new Set(before.map((vault) => vault.id));
    const expectedOwner = (this.ownerAddress ?? "").toLowerCase();
    const expectedTitle = input.title.trim() || "Untitled seal";
    const expectedRecipient = input.recipient.trim();

    const receipt = await this.writeReceipt("seal", [
      input.title,
      input.payloadCommitment,
      input.recipient,
      input.sigil,
      input.conditionVisibility,
      Date.now(),
    ]);
    const returned = this.extractReturn<unknown>(receipt);
    const returnedId =
      typeof returned === "string" && /^vault_\d+$/.test(returned) ? returned : null;

    // Bradbury receipts do not always expose the contract return in one stable
    // field. Reconcile against state and wait briefly for the accepted write to
    // become readable. Never submit the seal a second time.
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (returnedId) {
        const direct = await this.getVault(returnedId).catch(() => null);
        if (direct) return direct;
      }
      const vaults = await this.getVaults().catch(() => [] as Vault[]);
      const created = vaults.find(
        (vault) =>
          !knownIds.has(vault.id) &&
          vault.owner.toLowerCase() === expectedOwner &&
          vault.title === expectedTitle &&
          vault.recipient === expectedRecipient &&
          !vault.conditionBound,
      );
      if (created) return created;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new Error(
      "The seal was accepted but its new vault is not readable yet. Check the hall before creating another seal.",
    );
  }

  async bindCondition(vaultId: string, conditionText: string): Promise<Vault> {
    // Conditions are public because validators must independently judge them.
    // Payload confidentiality is handled separately by AES-GCM encryption.
    await this.writeReceipt("bind_condition", [vaultId, conditionText, Date.now()]);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const vault = await this.getVault(vaultId).catch(() => null);
      if (vault?.conditionBound) return vault;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new Error("The condition was accepted but its updated vault is not readable yet.");
  }

  async checkWorld(input: CheckWorldInput): Promise<CheckResult> {
    const receipt = await this.writeReceipt("check_world", [
      input.vaultId,
      input.sourceUri,
      input.sourceLabel,
      Date.now(),
    ]);
    const out = toPlain(this.extractReturn<any>(receipt)) ?? {};
    return {
      vaultId: input.vaultId,
      previousState: (out.previousState ?? "sealed") as VaultState,
      nextState: (out.nextState ?? "listening") as VaultState,
      met: Boolean(out.met),
      closeness: Number(out.closeness ?? 0),
      closenessBand: (Number(out.closenessBand ?? 0) as ClosenessBand) ?? 0,
      evidenceId: out.evidenceId ?? "",
      note: out.note ?? "",
    };
  }

  async openSeal(vaultId: string): Promise<OpenResult> {
    const receipt = await this.writeReceipt("open_seal", [vaultId, "", Date.now()]);
    const out = toPlain(this.extractReturn<any>(receipt)) ?? {};
    return {
      vaultId,
      ledgerId: out.ledgerId ?? "",
      payloadCommitment: out.payloadCommitment ?? "",
      openedAt: Number(out.openedAt ?? Date.now()),
      note: out.note ?? "The vault is open.",
    };
  }

  async entrust(vaultId: string, newRecipient: string): Promise<Vault> {
    await this.writeReceipt("entrust", [vaultId, newRecipient]);
    const vault = await this.getVault(vaultId);
    if (!vault) throw new Error("The seal was entrusted but could not be read back.");
    return vault;
  }

  // -- reads -----------------------------------------------------------

  async getVault(vaultId: string): Promise<Vault | null> {
    const vault = await this.read<any>("get_vault", [vaultId]);
    return vault ? (vault as Vault) : null;
  }

  async getVaults(): Promise<Vault[]> {
    const all: Vault[] = [];
    const limit = 20;
    let offset = 0;
    for (;;) {
      const page = await this.read<any[]>("get_vaults", [offset, limit]);
      if (!page || page.length === 0) break;
      all.push(...(page as Vault[]));
      if (page.length < limit) break;
      offset += limit;
    }
    return all;
  }

  async getEvidence(vaultId: string): Promise<Evidence[]> {
    return (await this.read<Evidence[]>("get_evidence", [vaultId])) ?? [];
  }

  async getLedger(): Promise<LedgerEntry[]> {
    const all: LedgerEntry[] = [];
    const limit = 20;
    let offset = 0;
    for (;;) {
      const page = await this.read<LedgerEntry[]>("get_ledger", [offset, limit]);
      if (!page || page.length === 0) break;
      all.push(...page);
      if (page.length < limit) break;
      offset += limit;
    }
    return all;
  }
}
