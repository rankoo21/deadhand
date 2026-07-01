# Deadhand

"Some words should wait for the world."

Deadhand is a candlelit chamber of sealed bronze vaults. Each vault holds a
secret behind a wax seal, bound to a real-world condition written in plain
language. The author cannot open it early. The recipient cannot force it. The
only thing that breaks the seal is agreement among GenLayer validators that the
condition has actually become true, read from public evidence.

## 1. What is this?

Deadhand is a sealed-message vault that opens only when a real-world condition
becomes true. You write a message, a bequest, a reveal, or an instruction, and
bind it to a condition such as "When this studio ships its 1.0 release" or "When
this world record is officially broken". The message is sealed with wax. It
stays held shut until the world catches up.

The experience moves through one chamber:

Press a seal -> bind a condition -> let it wait -> check the world -> watch the
seal melt -> the recipient reads.

This is not a DAO, not a vote, not a verdict, not a dashboard, and not a
time-locked wallet. The trigger is an interpreted event, not a clock.

## 2. Why GenLayer?

Deciding whether a fuzzy real-world condition has actually happened, given messy
public traces, is a subjective semantic judgment. A single server could fake it.
GenLayer validators each reproduce the interpretation and must agree on the
boolean "met" and on a coarse closeness band before the shared state advances
toward release. Consensus makes the release canonical and tamper resistant.
Deterministic guards bound the interpretation so a model cannot melt a seal on
weak, absent, or contradictory evidence.

## 3. The wax-and-condition metaphor

A seal is wax pressed with a sigil. Wax red is reserved for active, unmelted
seals. As keepers read public evidence, the wax warms and softens; when the
world agrees, the wax cracks and is releasable; when the recipient opens it, the
wax melts once and forever. The condition is the immutable promise carved into
the vault: written once at the Binding Altar, it can never change.

States: sealed, listening, nearing, releasable, opened, dormant. State is shown
by wax integrity, the gauge ring, and an engraved label, never by color alone.

## 4. The ritual journey

The chamber holds six ceremonial stations, navigated by the Censer (a swinging
brass incense burner), not a header:

1. The Antechamber. A single closed bronze vault on a plinth. Approach it to
   begin.
2. The Sealing Table. Write the message on parchment, choose a sigil, pour the
   wax.
3. The Binding Altar. Write the immutable condition into a recessed stone groove
   ringed by slow-turning gauges. Bind it.
4. The Vault Hall. The main space: a hall of bronze vaults, each with engraved
   controls to check the world, read the condition, open, or entrust.
5. The Melt. The one-time, full-screen ceremony where the wax liquefies, the
   sigil cracks, the door swings, and the released message rises.
6. The Keeper's Ledger. A heavy parchment ledger of opened records with their
   evidence trail, exportable as a rubbing, a pressed copy, or read aloud.

Identity is the Signet, a cold signet ring that warms with candlelight once
taken up. The footer is replaced by the Drip Line, a line of cooling wax along
the bottom edge.

## 5. Intelligent Contract concept

`contracts/DeadhandContract.py` models sealed payloads, immutable conditions,
world-checks, releases, and ledger entries. Methods:

- `seal` creates a sealed vault with a payload commitment (never plaintext),
  recipient, sigil, condition visibility, and sealed-at time.
- `bind_condition` binds immutable natural-language condition text. Once bound,
  it cannot change.
- `check_world` is the non-deterministic call. Validators read the public
  evidence and independently decide whether the condition is met. Comparative
  validation reruns the judgment and requires agreement on the boolean "met" and
  a coarse closeness band, so no single node can force a release. A deterministic
  evidence-overlap backstop must find a real textual trace before any release.
- `open_seal` is recipient-only and releasable-only. It reveals the payload
  reference once and records opened-at.
- `entrust` transfers keeper rights to another address (owner-only, pre-open).
- `get_vault`, `get_vaults`, `get_evidence`, `get_ledger`, `get_summary` are
  views. Private conditions are shrouded from non-parties.

Determinism rules: timestamps are passed in by the caller, never read from a
clock. State is derived deterministically from the agreed decision fields plus
the backstop, never from a model-chosen state word. Errors use `[EXPECTED]` and
`[LLM_ERROR]` prefixes so validators reach consensus on failure paths. No value
transfer, no escrow, no deposits; users pay only network fees.

## 6. Local mock mode

The chamber runs fully offline. With no configuration, `getAdapter()` returns a
`MockAdapter` that seeds preloaded vaults and simulates keeper readings with the
same logic the contract uses (`utils/vaultState.ts` mirrors the contract's
`_evidence_overlap` and state derivation). Nothing is sent anywhere; payloads
stay in an in-memory store until a seal is opened.

## 7. Folder structure

```
src/
  app/            page.tsx, layout.tsx, globals.css
  components/
    chamber/      Censer, DripLine, Signet, CandleField, ChamberWorld
    stations/     Antechamber, SealingTable, BindingAltar, VaultHall, TheMelt, KeepersLedger
    vault/        Vault, WaxSeal, Sigil, GaugeRing, EngravedPanel
    ui/           RitualButton, InkInput, StonePanel, EngraveText
  lib/genlayer/   mockAdapter.ts, contractAdapter.ts, types.ts, index.ts
  store/          useChamberStore.ts
  data/           mockConditions.ts, mockEvidence.ts
  utils/          format.ts, vaultState.ts
contracts/
  DeadhandContract.py
scripts/
  deploy.mjs, livecheck.mjs
```

## 8. Running locally

```
npm install
npm run dev
```

Open the printed local URL. The chamber starts in mock mode with preloaded
vaults, including one that is ready to melt for the demo.

To build the static export:

```
npm run build
```

The output is written to `out/` for static hosting.

## 9. Connecting a real contract

1. Put a funded key in `.env.deploy` (gitignored):
   ```
   GENLAYER_PRIVATE_KEY=...
   GENLAYER_NETWORK=bradbury
   ```
2. Deploy: `node scripts/deploy.mjs`. The deployed address is written back to
   `.env.deploy` as `DEADHAND_CONTRACT_ADDRESS`.
3. Point the frontend at it in `.env.local`:
   ```
   NEXT_PUBLIC_DEADHAND_MODE=contract
   NEXT_PUBLIC_DEADHAND_CONTRACT=0x...
   NEXT_PUBLIC_DEADHAND_NETWORK=bradbury
   ```
4. Rebuild so the address is baked into the export. The UI imports only the
   adapter interface, so swapping mock for contract touches no UI code.
5. Verify with `node scripts/livecheck.mjs`.

The Signet supports MetaMask (with the GenLayer Snap) and falls back to a
browser burner key for gasless networks.

## 10. Design principles

- Solemn, ceremonial, suspenseful, premium, literary, quiet.
- A single candlelit chamber, not pages. No header, no footer, no dashboard,
  no card grid.
- Named objects are honored: the Censer, the Signet, the Drip Line, the six
  stations, the wax-seal-and-condition metaphor, the one-time Melt.
- State never relies on color alone. Keyboard navigation, aria labels, focus
  states, and reduced-motion support throughout.
- Never approved, rejected, verdict, vote, or DAO. Only sealed, bound, nearing,
  releasable, opened, melted, confirmed.
