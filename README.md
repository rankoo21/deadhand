<div align="center">

# DEADHAND

### Some words should wait for the world.

<br />

[![Live Demo](https://img.shields.io/badge/Live_Demo-deadhand.pages.dev-1a1a1a?style=for-the-badge)](https://deadhand.pages.dev)
[![Network](https://img.shields.io/badge/Network-Testnet_Bradbury-8b0000?style=for-the-badge)](https://explorer-bradbury.genlayer.com/address/0xF6926D4e4A67dF1a65dbe160072a00950C67dFBd)
[![GenLayer](https://img.shields.io/badge/GenLayer-Intelligent_Contract-2d2d2d?style=for-the-badge)](https://genlayer.com)

[![Next.js 14](https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

<br />

```
------------------------------------------------------------------
   SEALED DOSSIER . CASE FILE: DEADHAND
   CLASSIFICATION: HELD SHUT UNTIL THE WORLD AGREES
   CUSTODY: GENLAYER VALIDATORS, TESTNET BRADBURY
   SEAL STATUS: INTACT
------------------------------------------------------------------
```

</div>

> A message is written. A condition is named. The wax is pressed.
> From that moment, no single hand can open it, not the author's, not the
> keeper's. The seal waits for the world to catch up.

---

## The Premise

Deadhand is a sealed-message vault that opens only when a real-world condition
becomes true. A user writes something meant for later (a message, a bequest, a
reveal, an instruction) and binds it to a condition stated in plain language:
"When this company goes public", "When this record is officially broken", "When
this studio ships its 1.0 release".

The message is committed behind a seal. It stays held shut until public evidence
confirms the condition has actually happened. The trigger is an interpreted
event, not a clock. This is not a time lock, not a vote, not a verdict, and not
a dashboard.

> The author cannot open it early. The recipient cannot force it. Only the world,
> as read and agreed by the keepers, melts the seal.

---

## Chain of Custody

The seal passes through hands that each hold a strict, bounded authority. No hand
holds more than its station allows.

| Custodian | Authority | Bound By |
| --- | --- | --- |
| The Author | Seals a payload, binds the condition once, may entrust before opening | Cannot open early; cannot rewrite a bound condition |
| The Condition | The immutable promise carved into the vault | Fixed at binding, never editable thereafter |
| The Keepers (GenLayer validators) | Read public evidence, independently judge whether the condition is met | Must agree on the outcome; deterministic guards bound the judgment |
| The Recipient | Opens the seal after release, reads the payload once | Only after release; only the named keeper |

Nothing of value is escrowed. There is no deposit and no transfer. Users pay only
network fees. Custody here is over a decision, not over funds.

---

## The Mechanism

### Role in GenLayer

Deadhand is a condition oracle and a gatekeeper. Its load-bearing question is not
"what time is it" but "did this real-world event actually happen, given messy
public evidence". That judgment is subjective and reproducible, and no single
server should own it.

When a vault is checked, the Intelligent Contract's `check_world` call asks
GenLayer validators to independently read the supplied public evidence and decide
whether the bound condition is truly met. Each validator reruns the
interpretation. Only when they agree does the shared state advance toward
release. Consensus makes the release canonical and tamper resistant: a lone node
cannot fake the world and force a seal open.

### Deterministic Guards

The interpretation is fenced so the model can never melt a seal on weak, absent,
or contradictory evidence.

- Condition text is immutable once bound. `bind_condition` refuses to change a
  condition that is already set.
- Only the recipient opens, and only after release. `open_seal` is recipient-only
  and releasable-only.
- `check_world` is user-triggered and rate-limited (a coarse minimum interval
  between checks on one vault, measured by a caller-supplied clock, never a
  server clock).
- Compact fields are stored, not raw plaintext. The payload commitment is a
  committed reference held shut until opening, revealed exactly once.
- Validation is comparative, not byte-equality. Validators must agree on the
  boolean `met` and on a coarse closeness band (cold, warm, hot). Prose rationale
  is never required to match word for word.
- A deterministic evidence-overlap backstop must find a real textual trace linking
  the evidence to the condition before any release is allowed.
- State is derived deterministically from the agreed decision plus the backstop,
  never from a model-chosen state word. Timestamps are passed in by the caller.
  Errors carry `[EXPECTED]` and `[LLM_ERROR]` prefixes so validators reach
  consensus on failure paths.

### Intelligent Contract Methods

`contracts/DeadhandContract.py` exposes the ceremony as contract methods:

- `seal` creates a sealed vault with a payload commitment, recipient, sigil, and
  condition visibility.
- `bind_condition` binds the immutable natural-language condition. Once bound, it
  cannot change.
- `check_world` is the non-deterministic call. Validators read public evidence,
  judge the condition, and must agree on `met` plus a closeness band.
- `open_seal` is recipient-only and releasable-only. It reveals the payload
  reference once and lands a ledger entry.
- `entrust` transfers keeper rights to another address (author-only, pre-open).
- `get_vault`, `get_vaults`, `get_evidence`, `get_ledger`, `get_summary` are read
  views. Private conditions are shrouded from non-parties.

### Verified Lifecycle

The full seal, bind, check, open flow has been exercised live on Testnet
Bradbury. A vault was created (`seal`), a condition was written (`bind_condition`),
the keepers were asked to read the evidence (`check_world`, where GenLayer
validators agreed an Apollo 11 style Moon-landing condition had been met), and the
named recipient opened the released seal (`open_seal`). The lifecycle is real, not
theoretical.

---

## Field Manual

### Reading (no wallet)

Browsing works with no wallet. You can read public conditions, inspect vaults, and
review the Keeper's Ledger without connecting anything.

### Writing (wallet required)

To seal a vault, bind a condition, or check the world, connect a MetaMask wallet
funded from the GenLayer Bradbury faucet:

- Faucet: https://testnet-faucet.genlayer.foundation/

### Run Locally

The chamber runs fully offline in mock mode by default. `getAdapter()` returns a
`MockAdapter` that seeds preloaded vaults and mirrors the contract's evidence and
state logic, so nothing leaves your machine until a real contract is configured.

```
npm install
npm run dev
```

Build the static export (written to `out/` for static hosting on Cloudflare
Pages):

```
npm run build
```

### Contract Checks

Lint the Intelligent Contract and run the direct-mode tests:

```
genvm-lint check contracts/DeadhandContract.py --json
python -m pytest tests/direct/ -p gltest_direct -q
```

### Connecting a Real Contract

Contract mode is selected by environment variables read in
`src/lib/genlayer/index.ts`:

```
NEXT_PUBLIC_DEADHAND_MODE=contract
NEXT_PUBLIC_DEADHAND_CONTRACT=0xF6926D4e4A67dF1a65dbe160072a00950C67dFBd
NEXT_PUBLIC_DEADHAND_NETWORK=bradbury
```

To deploy your own, place a funded key in `.env.deploy` (gitignored, never
committed):

```
GENLAYER_PRIVATE_KEY=...
GENLAYER_NETWORK=bradbury
```

Then run `node scripts/deploy.mjs`. The deployed address is written back as
`DEADHAND_CONTRACT_ADDRESS`. Point the frontend at it, rebuild, and verify with
`node scripts/livecheck.mjs`. The UI imports only the adapter interface, so
swapping mock for contract touches no UI code.

### Stack

Next.js 14, TypeScript, Tailwind CSS, Framer Motion, Zustand, and genlayer-js.
Shipped as a static export on Cloudflare Pages.

---

## Provenance

| Field | Record |
| --- | --- |
| Live application | https://deadhand.pages.dev |
| Network | GenLayer Testnet Bradbury |
| Contract address | `0xF6926D4e4A67dF1a65dbe160072a00950C67dFBd` |
| Contract on explorer | https://explorer-bradbury.genlayer.com/address/0xF6926D4e4A67dF1a65dbe160072a00950C67dFBd |
| Faucet | https://testnet-faucet.genlayer.foundation/ |
| Contract source | `contracts/DeadhandContract.py` |

> The seal is only as honest as the hands that refuse to break it early.
> Deadhand gives that refusal to consensus, and keeps the words until the world
> is ready to hear them.
