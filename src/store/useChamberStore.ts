"use client";

import { create } from "zustand";
import { getAdapter } from "@/lib/genlayer";
import { commitPayload, rememberKey, revealPayload } from "@/lib/genlayer/payload";
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
  // Plaintext recovered client-side from the revealed commitment, when the
  // local decryption key is present. Never derived from on-chain plaintext.
  revealedPayload: string | null;
  lastCheck: CheckResult | null;
  busy: boolean;
  error: string | null;
  notice: string | null;
  // Live progress of a slow on-chain write, shown so the user is never staring
  // at a silent spinner. { label, txHash? } or null when idle.
  progress: { label: string; txHash: string | null } | null;

  // draft seal in progress (Sealing Table + Binding Altar)
  draft: SealDraft;
  draftVaultId: string | null; // the freshly sealed or explicitly selected unbound vault
  setDraft: (patch: Partial<SealDraft>) => void;
  resetDraft: () => void;

  // lifecycle
  refresh: () => Promise<void>;
  pourTheWax: () => Promise<void>;
  beginBinding: (vaultId: string) => void;
  bindCondition: (conditionText: string) => Promise<void>;
  setActiveVault: (id: string | null) => void;
  checkWorld: (vaultId: string, sourceUri: string, sourceLabel: string) => Promise<void>;
  checkTheHall: () => Promise<void>;
  beginMelt: (vaultId: string) => void;
  openSeal: (vaultId: string) => Promise<void>;
  entrust: (vaultId: string, newRecipient: string) => Promise<void>;
  clearMelt: () => void;
  clearMessages: () => void;
}

const adapter = getAdapter();
const ACTIVE_VAULT_STORAGE_KEY = "deadhand:active-vault";

function readRememberedVault(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_VAULT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function rememberActiveVault(vaultId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (vaultId) window.localStorage.setItem(ACTIVE_VAULT_STORAGE_KEY, vaultId);
    else window.localStorage.removeItem(ACTIVE_VAULT_STORAGE_KEY);
  } catch {
    // Selection persistence is a convenience; storage failure must not block the app.
  }
}

const EXPLORER_TX = "https://explorer-bradbury.genlayer.com/tx/";

// Bridge the adapter's write phases into a UI-friendly progress object. Set
// once here; each write action clears it in its finally block.
function wireProgress(
  set: (partial: Partial<ChamberState>) => void,
): void {
  if ((adapter as any).onPhase !== undefined) {
    (adapter as any).onPhase = (phase: string, detail?: string) => {
      switch (phase) {
        case "submitting":
          set({ progress: { label: "Sign the transaction in MetaMask...", txHash: null } });
          break;
        case "resubmitting":
          set({ progress: { label: "Re-sign the transaction in MetaMask...", txHash: null } });
          break;
        case "submitted":
          set({
            progress: {
              label: "Sent. Validators are reaching consensus (this can take a few minutes)...",
              txHash: detail ?? null,
            },
          });
          break;
        case "polling":
          set({
            progress: {
              label: "Still pending. Watching the same transaction — no duplicate was sent...",
              txHash: detail ?? null,
            },
          });
          break;
        case "accepted":
          set({ progress: { label: "Accepted on-chain. Settling state...", txHash: detail ?? null } });
          break;
        default:
          break;
      }
    };
  }
}

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

export const useChamberStore = create<ChamberState>((set, get) => {
  // Route adapter write phases into the progress banner (once).
  wireProgress(set);
  return {
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
        set({ busy: false, progress: null });
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
  revealedPayload: null,
  lastCheck: null,
  busy: false,
  error: null,
  notice: null,
  progress: null,

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
    const remembered = get().activeVaultId ?? readRememberedVault();
    const activeVaultId =
      remembered && vaults.some((vault) => vault.id === remembered) ? remembered : null;
    rememberActiveVault(activeVaultId);
    set({ vaults, ledger, evidenceByVault, activeVaultId });
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
      // The plaintext secret is committed client-side into an encrypted envelope
      // BEFORE anything touches the chain. Only the opaque commitment is sent;
      // the raw plaintext never leaves the browser. The decryption key is held
      // locally and remembered against the vault id once it is known.
      const { commitment, keyRef } = await commitPayload(draft.message.trim());
      const vault = await adapter.seal({
        owner: signetAddress ?? "",
        title: draft.title.trim() || draft.message.trim().slice(0, 40),
        payloadCommitment: commitment,
        recipient: draft.recipient.trim(),
        sigil: draft.sigil,
        conditionVisibility: draft.conditionVisibility,
      });
      rememberKey(vault.id, keyRef);
      rememberActiveVault(vault.id);
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
      set({ busy: false, progress: null });
    }
  },

  beginBinding: (vaultId) => {
    const { vaults, signetAddress } = get();
    const vault = vaults.find((item) => item.id === vaultId);
    if (!vault) {
      set({ error: "That vault could not be found. Refresh the hall and try again." });
      return;
    }
    if (vault.conditionBound) {
      set({ error: "This vault already has a bound condition." });
      return;
    }
    if (signetAddress && vault.owner.toLowerCase() !== signetAddress.toLowerCase()) {
      set({ error: "Only the hand that pressed this seal can bind its condition." });
      return;
    }
    rememberActiveVault(vaultId);
    set({
      draftVaultId: vaultId,
      activeVaultId: vaultId,
      station: "altar",
      error: null,
      notice: `Selected ${vault.id}. Write the public condition that validators will judge.`,
    });
  },

  bindCondition: async (conditionText) => {
    if (!ensureSignet(get, set)) return;
    const vaultId = get().draftVaultId;
    if (!vaultId) {
      set({ error: "Choose an unbound vault in the hall before binding a condition." });
      return;
    }
    const vault = get().vaults.find((item) => item.id === vaultId);
    if (!vault || vault.conditionBound) {
      set({ error: "This vault is unavailable or its condition is already bound." });
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
      set({ busy: false, progress: null });
    }
  },

  setActiveVault: (id) => {
    rememberActiveVault(id);
    set({ activeVaultId: id });
  },

  checkWorld: async (vaultId, sourceUri, sourceLabel) => {
    if (!ensureSignet(get, set)) return;
    set({ busy: true, error: null });
    try {
      const result = await adapter.checkWorld({ vaultId, sourceUri, sourceLabel });
      await get().refresh();
      set({ lastCheck: result, notice: result.note });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ busy: false, progress: null });
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
        const sourceUri = last?.sourceUri ?? "";
        const label = last?.sourceLabel ?? "Hall sweep";
        if (!sourceUri) continue;
        try {
          await adapter.checkWorld({ vaultId: v.id, sourceUri, sourceLabel: label });
        } catch {
          // a single vault failing should not stop the candle flare
        }
      }
      await get().refresh();
      set({ notice: "A candle flare passed down the hall. The vaults were re-read." });
    } finally {
      set({ busy: false, progress: null });
    }
  },

  beginMelt: (vaultId) =>
    set({ meltVaultId: vaultId, meltResult: null, revealedPayload: null, station: "melt" }),

  openSeal: async (vaultId) => {
    if (!ensureSignet(get, set)) return;
    set({ busy: true, error: null });
    try {
      const result = await adapter.openSeal(vaultId);
      // The revealed commitment is decrypted client-side with the locally held
      // key. If the key is absent (a different device), the opaque reference is
      // shown instead; the plaintext is never reconstructed from on-chain data.
      const revealedPayload = await revealPayload(vaultId, result.payloadCommitment);
      await get().refresh();
      set({
        meltVaultId: vaultId,
        meltResult: result,
        revealedPayload,
        station: "melt",
        notice: "The vault is open. Released to the keeper.",
      });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ busy: false, progress: null });
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
      set({ busy: false, progress: null });
    }
  },

  clearMelt: () => set({ meltVaultId: null, meltResult: null, revealedPayload: null }),
  clearMessages: () => set({ error: null, notice: null }),
  };
});
