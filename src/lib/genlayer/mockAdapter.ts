import {
  CheckResult,
  CheckWorldInput,
  DeadhandAdapter,
  Evidence,
  LedgerEntry,
  OpenResult,
  SealInput,
  Vault,
} from "./types";
import { decideCheck, bandOf } from "@/utils/vaultState";
import { makeId, mockTxHash } from "@/utils/format";
import { PRELOADED_VAULTS } from "@/data/mockConditions";

const MOCK_OWNER = "0xSignet_demo_chamber_author_00001";

// In-memory store. Mirrors what the contract holds authoritatively.
class MockStore {
  vaults = new Map<string, Vault>();
  evidence = new Map<string, Evidence>();
  ledger = new Map<string, LedgerEntry>();
  // Plaintext payloads are kept only in the mock, keyed by vault, to simulate
  // the committed reference resolving once the seal is opened.
  payloads = new Map<string, string>();
  seeded = false;
}

const store = new MockStore();

function seedDefaults() {
  if (store.seeded) return;
  store.seeded = true;

  const now = Date.now();
  PRELOADED_VAULTS.forEach((preset) => {
    const id = makeId("vault");
    const sealedAt = now - preset.sealedDaysAgo * 24 * 60 * 60 * 1000;
    const lastCheckedAt =
      preset.lastCheckedHoursAgo === null
        ? null
        : now - preset.lastCheckedHoursAgo * 60 * 60 * 1000;
    const opened = preset.state === "opened";
    const vault: Vault = {
      id,
      owner: MOCK_OWNER,
      recipient: preset.recipient,
      sigil: preset.sigil,
      title: preset.title,
      payloadCommitment: opened ? `sealed://${id}` : "",
      conditionText: preset.conditionText,
      conditionVisibility: preset.conditionVisibility,
      conditionBound: true,
      conditionShrouded: false,
      state: preset.state,
      sealedAt,
      lastCheckedAt,
      openedAt: null,
      closeness: preset.closeness,
      closenessBand: bandOf(preset.closeness),
      opened,
    };
    store.vaults.set(id, vault);
    store.payloads.set(id, preset.message);
  });
}

// Small artificial latency so the rituals feel physical, not instant.
function delay<T>(value: T, ms = 420): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export class MockAdapter implements DeadhandAdapter {
  readonly mode = "mock" as const;

  constructor() {
    seedDefaults();
  }

  getIdentityAddress(): string | null {
    return MOCK_OWNER;
  }

  async seal(input: SealInput): Promise<Vault> {
    if (!input.payloadCommitment.trim()) {
      throw new Error("A seal needs words before it can be pressed.");
    }
    if (!input.recipient.trim()) {
      throw new Error("A seal needs a keeper to receive it.");
    }
    const id = makeId("vault");
    const vault: Vault = {
      id,
      owner: input.owner || MOCK_OWNER,
      recipient: input.recipient.trim(),
      sigil: input.sigil,
      title: input.title.trim() || "Untitled seal",
      payloadCommitment: "",
      conditionText: "",
      conditionVisibility: input.conditionVisibility,
      conditionBound: false,
      conditionShrouded: false,
      state: "sealed",
      sealedAt: Date.now(),
      lastCheckedAt: null,
      openedAt: null,
      closeness: 0,
      closenessBand: 0,
      opened: false,
    };
    store.vaults.set(id, vault);
    // The plaintext never leaves the mock store until the seal is opened.
    store.payloads.set(id, input.payloadCommitment.trim());
    return delay(vault);
  }

  async bindCondition(vaultId: string, conditionText: string): Promise<Vault> {
    const vault = store.vaults.get(vaultId);
    if (!vault) throw new Error("That vault could not be found in the chamber.");
    if (vault.conditionBound) throw new Error("Once bound, the condition cannot change.");
    if (!conditionText.trim()) throw new Error("Bind a condition before the vault can wait.");
    vault.conditionText = conditionText.trim();
    vault.conditionBound = true;
    return delay(vault);
  }

  async checkWorld(input: CheckWorldInput): Promise<CheckResult> {
    const vault = store.vaults.get(input.vaultId);
    if (!vault) throw new Error("That vault could not be found in the chamber.");
    if (!vault.conditionBound) throw new Error("Bind a condition before the vault can wait.");
    if (vault.opened || vault.state === "opened") throw new Error("This vault is already open.");

    const previousState = vault.state;
    // The mock keeper reading mirrors the contract's consensus + backstop.
    const reading = decideCheck(vault.state, vault.conditionText, input.evidence);

    // A releasable vault never falls back.
    let nextState = reading.nextState;
    if (previousState === "releasable") nextState = "releasable";

    vault.state = nextState;
    vault.closeness = reading.closeness;
    vault.closenessBand = reading.band;
    vault.lastCheckedAt = Date.now();

    const id = makeId("evidence");
    const evidence: Evidence = {
      id,
      vaultId: vault.id,
      sourceLabel: input.sourceLabel.trim() || "Snapshot",
      snapshot: input.evidence.trim(),
      checkedAt: Date.now(),
    };
    store.evidence.set(id, evidence);

    const result: CheckResult = {
      vaultId: vault.id,
      previousState,
      nextState,
      met: reading.met,
      closeness: reading.closeness,
      closenessBand: reading.band,
      evidenceId: id,
      note: reading.note,
    };
    return delay(result);
  }

  async openSeal(vaultId: string): Promise<OpenResult> {
    const vault = store.vaults.get(vaultId);
    if (!vault) throw new Error("That vault could not be found in the chamber.");
    if (vault.opened || vault.state === "opened") throw new Error("This vault is already open.");
    if (vault.state !== "releasable") throw new Error("This vault is not ready to open.");

    const openedAt = Date.now();
    vault.opened = true;
    vault.openedAt = openedAt;
    vault.state = "opened";
    const payload = store.payloads.get(vaultId) ?? "";
    vault.payloadCommitment = payload;

    const trail = [...store.evidence.values()]
      .filter((e) => e.vaultId === vaultId)
      .map((e) => e.sourceLabel)
      .join(" \u00b7 ");

    const ledgerId = makeId("ledger");
    const entry: LedgerEntry = {
      id: ledgerId,
      vaultId: vault.id,
      title: vault.title,
      conditionText: vault.conditionText,
      recipient: vault.recipient,
      evidenceTrail: trail || "No evidence recorded",
      sealedAt: vault.sealedAt,
      openedAt,
      mockTxHash: mockTxHash(),
      state: "opened",
    };
    store.ledger.set(ledgerId, entry);

    return delay({
      vaultId: vault.id,
      ledgerId,
      payloadCommitment: payload,
      openedAt,
      note: "The vault is open. Released to the keeper.",
    });
  }

  async entrust(vaultId: string, newRecipient: string): Promise<Vault> {
    const vault = store.vaults.get(vaultId);
    if (!vault) throw new Error("That vault could not be found in the chamber.");
    if (vault.opened || vault.state === "opened") {
      throw new Error("An opened vault can no longer be entrusted.");
    }
    if (!newRecipient.trim()) throw new Error("Name a keeper to entrust this seal to.");
    vault.recipient = newRecipient.trim();
    return delay(vault);
  }

  async getVault(vaultId: string): Promise<Vault | null> {
    return delay(store.vaults.get(vaultId) ?? null, 80);
  }

  async getVaults(): Promise<Vault[]> {
    return delay(
      [...store.vaults.values()].sort((a, b) => b.sealedAt - a.sealedAt),
      80,
    );
  }

  async getEvidence(vaultId: string): Promise<Evidence[]> {
    return delay(
      [...store.evidence.values()]
        .filter((e) => e.vaultId === vaultId)
        .sort((a, b) => a.checkedAt - b.checkedAt),
      60,
    );
  }

  async getLedger(): Promise<LedgerEntry[]> {
    return delay(
      [...store.ledger.values()].sort((a, b) => b.openedAt - a.openedAt),
      80,
    );
  }
}
