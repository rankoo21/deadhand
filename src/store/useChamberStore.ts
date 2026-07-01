"use client";

import { create } from "zustand";
import { getAdapter } from "@/lib/genlayer";
import type {
  CheckResult,
  ConditionVisibility,
  Evidence,
  LedgerEntry,
  OpenResult,
  SigilStyle,
  Vault,
} from "@/lib/genlayer/types";
import { shortAddress } from "@/utils/format";

// The six ceremonial stations of the chamber.
export type Station =
  | "antechamber"
  | "table"
  | "altar"
  | "hall"
  | "melt"
  | "ledger";

interface SealDraft {
  message: string;
  recipient: string;
  sigil: SigilStyle;
  conditionVisibility: ConditionVisibility;
  title: string;
}

const EMPTY_DRAFT: SealDraft = {
  message: "",
  recipient: "",
  sigil: "crescent",
  conditionVisibility: "public",
  title: "",
};

interface ChamberState {
  // navigation between stations
  station: Station;
  setStation: (s: Station) => void;

  // the signet (wallet / identity)
  signetAddress: string | null;
  signetLabel: string;
  takeUpSignet: () => Promise<void>;
  setDownSignet: () => void;

  // data
  vaults: Vault[];
  ledger: LedgerEntry[];
  evidenceByVault: Record<string, Evidence[]>;
  activeVaultId: string | null;
  meltVaultId: string | null;
  meltResult: OpenResult | null;
  lastCheck: CheckResult | null;
  busy: boolean;
  error: string | null;
  notice: string | null;

  // draft seal in progress (Sealing Table + Binding Altar)
  draft: SealDraft;
  draftVaultId: string | null; // the freshly sealed, not-yet-bound vault
  setDraft: (patch: Partial<SealDraft>) => void;
  resetDraft: () => void;

  // lifecycle
  refresh: () => Promise<void>;
  pourTheWax: () => Promise<void>;
  bindCondition: (conditionText: string) => Promise<void>;
  setActiveVault: (id: string | null) => void;
  checkWorld: (vaultId: string, evidence: string, sourceLabel: string) => Promise<void>;
  checkTheHall: () => Promise<void>;
  beginMelt: (vaultId: string) => void;
  openSeal: (vaultId: string) => Promise<void>;
  entrust: (vaultId: string, newRecipient: string) => Promise<void>;
  clearMelt: () => void;
  clearMessages: () => void;
}

const adapter = getAdapter();

// Writing requires a taken-up signet. In contract mode that means a real
// connected browser wallet; in mock mode the fixed mock identity is enough.
// Returns true when a write may proceed.
function ensureSignet(
  get: () => ChamberState,
  set: (partial: Partial<ChamberState>) => void,
): boolean {
  if (adapter.mode === "contract") {
    const connected = adapter.isUsingWallet?.() ?? false;
    if (!connected || !get().signetAddress) {
      set({ error: "Take up the signet to do this." });
      return false;
    }
  }
  return true;
}

export const useChamberStore = create<ChamberState>((set, get) => ({
  station: "antechamber",
  setStation: (s) => set({ station: s }),

  signetAddress: null,
  signetLabel: "Take up the signet",
  takeUpSignet: async () => {
    // Contract mode: the only identity path is a real browser wallet.
    if (adapter.mode === "contract") {
      if (!adapter.hasInjectedWallet?.() || !adapter.connectWallet) {
        set({
          error:
            "No browser wallet found. Install MetaMask with the GenLayer Snap to take up the signet.",
        });
        return;
      }
      set({ busy: true, error: null });
      try {
        const addr = await adapter.connectWallet();
        set({ signetAddress: addr, signetLabel: shortAddress(addr) });
      } catch (e) {
        set({ error: (e as Error).message });
      } finally {
        set({ busy: false });
      }
      return;
    }
    // Mock mode: use the adapter's fixed identity, no synthetic keys.
    const real = adapter.getIdentityAddress();
    if (real) {
      set({ signetAddress: real, signetLabel: shortAddress(real) });
    }
  },
  setDownSignet: () => {
    adapter.disconnectWallet?.();
    set({ signetAddress: null, signetLabel: "Take up the signet" });
  },

  vaults: [],
  ledger: [],
  evidenceByVault: {},
  activeVaultId: null,
  meltVaultId: null,
  meltResult: null,
  lastCheck: null,
  busy: false,
  error: null,
  notice: null,

  draft: { ...EMPTY_DRAFT },
  draftVaultId: null,
  setDraft: (patch) => set({ draft: { ...get().draft, ...patch } }),
  resetDraft: () => set({ draft: { ...EMPTY_DRAFT }, draftVaultId: null }),

  refresh: async () => {
    const [vaults, ledger] = await Promise.all([
      adapter.getVaults(),
      adapter.getLedger(),
    ]);
    const evidenceByVault: Record<string, Evidence[]> = {};
    await Promise.all(
      vaults.map(async (v) => {
        evidenceByVault[v.id] = await adapter.getEvidence(v.id);
      }),
    );
    set({ vaults, ledger, evidenceByVault });
  },

  pourTheWax: async () => {
    const { draft, signetAddress } = get();
    if (!ensureSignet(get, set)) return;
    if (!draft.message.trim()) {
      set({ error: "A seal needs words before it can be pressed." });
      return;
    }
    if (!draft.recipient.trim()) {
      set({ error: "A seal needs a keeper to receive it." });
      return;
    }
    set({ busy: true, error: null });
    try {
      const vault = await adapter.seal({
        owner: signetAddress ?? "",
        title: draft.title.trim() || draft.message.trim().slice(0, 40),
        payloadCommitment: draft.message.trim(),
        recipient: draft.recipient.trim(),
        sigil: draft.sigil,
        conditionVisibility: draft.conditionVisibility,
      });
      await get().refresh();
      set({
        draftVaultId: vault.id,
        activeVaultId: vault.id,
        station: "altar",
        notice: "The wax is poured. Now bind the condition.",
      });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ busy: false });
    }
  },

  bindCondition: async (conditionText) => {
    if (!ensureSignet(get, set)) return;
    const vaultId = get().draftVaultId ?? get().activeVaultId;
    if (!vaultId) {
      set({ error: "Press a seal before binding a condition." });
      return;
    }
    if (!conditionText.trim()) {
      set({ error: "Bind a condition before the vault can wait." });
      return;
    }
    set({ busy: true, error: null });
    try {
      await adapter.bindCondition(vaultId, conditionText.trim());
      await get().refresh();
      get().resetDraft();
      set({
        activeVaultId: vaultId,
        station: "hall",
        notice: "The condition is bound. The vault takes its place in the hall.",
      });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ busy: false });
    }
  },

  setActiveVault: (id) => set({ activeVaultId: id }),

  checkWorld: async (vaultId, evidence, sourceLabel) => {
    if (!ensureSignet(get, set)) return;
    set({ busy: true, error: null });
    try {
      const result = await adapter.checkWorld({ vaultId, evidence, sourceLabel });
      await get().refresh();
      set({ lastCheck: result, notice: result.note });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ busy: false });
    }
  },

  checkTheHall: async () => {
    if (!ensureSignet(get, set)) return;
    const { vaults, evidenceByVault } = get();
    const checkable = vaults.filter(
      (v) => v.conditionBound && !v.opened && v.state !== "opened",
    );
    if (checkable.length === 0) {
      set({ notice: "No bound vaults are waiting. Bind a condition first." });
      return;
    }
    set({ busy: true, error: null });
    try {
      for (const v of checkable) {
        // Re-evaluate against the most recent evidence the keepers have read.
        const trail = evidenceByVault[v.id] ?? [];
        const last = trail[trail.length - 1];
        const evidence = last?.snapshot ?? "";
        const label = last?.sourceLabel ?? "Hall sweep";
        if (!evidence) continue;
        try {
          await adapter.checkWorld({ vaultId: v.id, evidence, sourceLabel: label });
        } catch {
          // a single vault failing should not stop the candle flare
        }
      }
      await get().refresh();
      set({ notice: "A candle flare passed down the hall. The vaults were re-read." });
    } finally {
      set({ busy: false });
    }
  },

  beginMelt: (vaultId) => set({ meltVaultId: vaultId, meltResult: null, station: "melt" }),

  openSeal: async (vaultId) => {
    if (!ensureSignet(get, set)) return;
    set({ busy: true, error: null });
    try {
      const result = await adapter.openSeal(vaultId);
      await get().refresh();
      set({
        meltVaultId: vaultId,
        meltResult: result,
        station: "melt",
        notice: "The vault is open. Released to the keeper.",
      });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ busy: false });
    }
  },

  entrust: async (vaultId, newRecipient) => {
    if (!ensureSignet(get, set)) return;
    set({ busy: true, error: null });
    try {
      await adapter.entrust(vaultId, newRecipient);
      await get().refresh();
      set({ notice: "The seal was entrusted to another keeper." });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ busy: false });
    }
  },

  clearMelt: () => set({ meltVaultId: null, meltResult: null }),
  clearMessages: () => set({ error: null, notice: null }),
}));
