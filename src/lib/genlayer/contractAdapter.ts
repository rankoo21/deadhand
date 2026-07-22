import { createAccount, createClient, generatePrivateKey } from "genlayer-js";
import { localnet, studionet, testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import type {
  PendingCheck,
  PhaseUpdate,
  SubmitCheckInput,
  TestLensResult,
  TestLensSummary,
  TransactionHash,
} from "./types";

type Client = ReturnType<typeof createClient>;
type EthereumProvider = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };

const PENDING_KEY = "testlens.pending.v1";
const PENDING_APP = "testlens" as const;
const ACCEPTED = TransactionStatus.ACCEPTED;
const SUCCESSFUL_EXECUTION = "FINISHED_WITH_RETURN";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function asHash(value: unknown): TransactionHash {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("GenLayer returned an invalid transaction hash.");
  }
  return value as TransactionHash;
}

function asAccount(value: unknown): `0x${string}` {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error("The saved pending transaction has an invalid account.");
  }
  return value as `0x${string}`;
}

export interface ContractAdapterConfig {
  contractAddress: string;
  network?: string;
}

function chainFor(network?: string) {
  switch ((network ?? "studionet").toLowerCase()) {
    case "bradbury":
    case "testnet-bradbury":
    case "testnetbradbury":
      return testnetBradbury;
    case "localnet":
      return localnet;
    default:
      return studionet;
  }
}

function snapNetwork(network?: string): "studionet" | "testnetBradbury" | "localnet" {
  const value = (network ?? "studionet").toLowerCase();
  if (value === "localnet") return "localnet";
  if (value.includes("bradbury")) return "testnetBradbury";
  return "studionet";
}

function plain(value: unknown): any {
  if (value instanceof Map) {
    return Object.fromEntries([...value.entries()].map(([key, item]) => [String(key), plain(item)]));
  }
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === "bigint") return Number(value);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  }
  return value;
}

function getEthereum(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  return ((window as typeof window & { ethereum?: EthereumProvider }).ethereum ?? null);
}

export class ContractAdapter {
  readonly mode = "contract" as const;
  readonly onPhaseListeners = new Set<(update: PhaseUpdate) => void>();
  private readonly config: ContractAdapterConfig;
  private readonly chain: ReturnType<typeof chainFor>;
  private readonly readClient: Client;
  private walletClient: Client | null = null;
  private walletAddress: `0x${string}` | null = null;

  constructor(config: ContractAdapterConfig) {
    if (!config.contractAddress) throw new Error("TestLens contract address is not configured.");
    this.config = config;
    this.chain = chainFor(config.network);
    this.readClient = createClient({ chain: this.chain, account: createAccount(generatePrivateKey()) });
  }

  private get address(): `0x${string}` {
    return this.config.contractAddress as `0x${string}`;
  }

  subscribe(listener: (update: PhaseUpdate) => void): () => void {
    this.onPhaseListeners.add(listener);
    return () => this.onPhaseListeners.delete(listener);
  }

  private emit(phase: PhaseUpdate["phase"], detail?: string, hash?: TransactionHash): void {
    this.onPhaseListeners.forEach((listener) => listener({ phase, detail, hash }));
  }

  getExplorerUrl(hash: string): string | null {
    const base = this.chain.blockExplorers?.default?.url;
    if (!base) return null;
    return `${base.replace(/\/$/, "")}/tx/${hash}`;
  }

  hasInjectedWallet(): boolean {
    return Boolean(getEthereum());
  }

  get connectedAddress(): string | null {
    return this.walletAddress;
  }

  async connectWallet(): Promise<string> {
    const provider = getEthereum();
    if (!provider) throw new Error("MetaMask with GenLayer Snap is required to submit a check.");
    this.emit("connecting", "Requesting the selected MetaMask account.");
    const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
    const selected = asAccount(accounts?.[0]);

    const walletClient = createClient({ chain: this.chain, account: selected, provider });
    await walletClient.connect(snapNetwork(this.config.network));
    this.walletClient = walletClient;
    this.walletAddress = selected;
    return selected;
  }

  disconnectWallet(): void {
    this.walletClient = null;
    this.walletAddress = null;
  }

  private async read<T>(functionName: string, args: unknown[] = []): Promise<T> {
    const value = await this.readClient.readContract({
      address: this.address,
      functionName,
      args: args as any,
    });
    return plain(value) as T;
  }

  async getResult(requestId: string, sender?: string): Promise<TestLensResult | null> {
    return (await this.read<TestLensResult | null>("get_result", [requestId, sender ?? ""])) ?? null;
  }

  async getResults(offset = 0, limit = 20): Promise<TestLensResult[]> {
    return (await this.read<TestLensResult[]>("get_results", [offset, limit])) ?? [];
  }

  async getSummary(): Promise<TestLensSummary> {
    return await this.read<TestLensSummary>("get_summary");
  }

  getPending(): PendingCheck | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;

    try {
      const value = JSON.parse(raw) as Partial<PendingCheck>;
      if (
        value.app !== PENDING_APP ||
        typeof value.request !== "string" ||
        !value.request ||
        typeof value.timestamp !== "number" ||
        !Number.isSafeInteger(value.timestamp) ||
        value.timestamp < 0
      ) {
        throw new Error("The saved pending transaction is malformed or belongs to another app.");
      }
      return Object.freeze({
        app: PENDING_APP,
        request: value.request,
        hash: asHash(value.hash),
        account: asAccount(value.account),
        timestamp: value.timestamp,
      });
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error("The saved pending transaction could not be read.");
    }
  }

  private savePending(value: PendingCheck): void {
    localStorage.setItem(PENDING_KEY, JSON.stringify(value));
  }

  private clearPending(): void {
    localStorage.removeItem(PENDING_KEY);
  }

  private async verifyReadback(pending: PendingCheck): Promise<TestLensResult> {
    this.emit("verifying", "Reading canonical contract state with the read-only client.", pending.hash);
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const result = await this.getResult(pending.request, pending.account).catch(() => null);
      if (result?.request_id === pending.request) {
        this.clearPending();
        this.emit("complete", "Canonical result verified.", pending.hash);
        return result;
      }
      await sleep(1500);
    }
    throw new Error("The transaction was accepted, but canonical state is not readable yet. Recovery will continue from the saved hash.");
  }

  private async pollPending(pending: PendingCheck): Promise<TestLensResult> {
    if (!this.walletClient || this.walletAddress?.toLowerCase() !== pending.account.toLowerCase()) {
      await this.connectWallet();
    }
    if (this.walletAddress?.toLowerCase() !== pending.account.toLowerCase()) {
      throw new Error("Select the same wallet account that submitted the pending check.");
    }
    this.emit("consensus", "Polling the saved transaction hash only.", pending.hash);
    const receipt = await this.walletClient!.waitForTransactionReceipt({
      hash: pending.hash as any,
      status: ACCEPTED,
      interval: 6000,
      retries: 150,
    });
    const receiptData = plain(receipt);
    const status = receiptData?.statusName ?? receiptData?.status;
    if (status !== ACCEPTED && status !== "ACCEPTED") {
      throw new Error(`Transaction ended with status ${String(status ?? "unknown")}.`);
    }
    const execution = receiptData?.txExecutionResultName;
    if (execution !== SUCCESSFUL_EXECUTION) {
      throw new Error(`Contract execution did not succeed: ${String(execution ?? "unknown")}.`);
    }
    this.emit("accepted", "Consensus accepted the transaction and execution returned successfully.", pending.hash);
    return this.verifyReadback(pending);
  }

  async recoverPending(): Promise<TestLensResult | null> {
    const pending = this.getPending();
    if (!pending) return null;
    const existing = await this.getResult(pending.request, pending.account).catch(() => null);
    if (existing) {
      this.clearPending();
      this.emit("complete", "Recovered canonical result.", pending.hash);
      return existing;
    }
    return this.pollPending(pending);
  }

  async submitCheck(input: SubmitCheckInput): Promise<TestLensResult> {
    const existingPending = this.getPending();
    if (existingPending) {
      if (existingPending.request !== input.requestId) {
        throw new Error(`A check (${existingPending.request}) is already pending. Recover it before submitting another.`);
      }
      return this.pollPending(existingPending);
    }
    if (!this.walletClient || !this.walletAddress) await this.connectWallet();
    this.emit("signing", "Approve one submit_check transaction in MetaMask.");
    const payload = JSON.stringify({
      feature_requirement: input.featureRequirement.trim(),
      tests_summary: input.testsSummary.trim(),
      risk_context: input.riskContext?.trim() ?? "",
    });
    const timestamp = Date.now();

    const hash = asHash(await this.walletClient!.writeContract({
      address: this.address,
      functionName: "submit_check",
      args: [input.requestId, payload, timestamp] as any,
      value: 0n,
    }));
    const pending: PendingCheck = Object.freeze({
      app: PENDING_APP,
      request: input.requestId,
      hash,
      account: this.walletAddress!,
      timestamp,
    });
    this.savePending(pending);
    this.emit("submitted", "Transaction hash saved locally for refresh-safe recovery.", hash);
    return this.pollPending(pending);
  }
}