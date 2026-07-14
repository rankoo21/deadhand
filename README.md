<div align="center">

# Deadhand

Some words should wait for the world.

[![Network](https://img.shields.io/badge/Network-GenLayer_Bradbury-8b0000?style=flat-square)](https://explorer-bradbury.genlayer.com/address/0xA075679ad3004D87eEAf583CE60208f57Ee4D38F)
[![chainId](https://img.shields.io/badge/chainId-4221-2d2d2d?style=flat-square)](https://explorer-bradbury.genlayer.com)
[![Status](https://img.shields.io/badge/Status-live-2e7d32?style=flat-square)](https://deadhand.pages.dev)
[![Contract](https://img.shields.io/badge/Contract-Python_GenVM-3776ab?style=flat-square)](contracts/DeadhandContract.py)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js-000000?style=flat-square)](https://nextjs.org)

</div>

## On-chain proof

Deadhand is deployed and exercised on GenLayer Testnet Bradbury. The full lifecycle below is real and verifiable on the explorer.

| Item | Value |
| --- | --- |
| Contract | [0xA075679ad3004D87eEAf583CE60208f57Ee4D38F](https://explorer-bradbury.genlayer.com/address/0xA075679ad3004D87eEAf583CE60208f57Ee4D38F) |
| Live app | [deadhand.pages.dev](https://deadhand.pages.dev) |

The payload is never stored as readable plaintext. At seal time the contract holds only a commitment (an opaque client-side reference or ciphertext); views keep it shrouded and the readable reference is disclosed only on the `open_seal` path, after release, to the recipient. `check_world` does not release on caller-supplied prose: validators independently re-judge the evidence and must agree comparatively on the boolean `met`, on an independent `authenticated` finding, and on a coarse closeness band, backed by a deterministic authentication gate. There is no byte-equality on model prose.

The current contract was freshly redeployed (payload commitment storage plus authenticated release consensus). The lifecycle transactions below were exercised end to end on a prior deployment of the same contract logic and remain verifiable on the explorer:

| Step | Method | Transaction |
| --- | --- | --- |
| Seal a vault | `seal` | [0xc87a7f...52a4](https://explorer-bradbury.genlayer.com/tx/0xc87a7fe1a7da7b880d1d95f2af3915b9c0b8f8506b3b0c4692fc8cc5906752a4) |
| Bind the condition | `bind_condition` | [0x538660...44f3b](https://explorer-bradbury.genlayer.com/tx/0x5386605e7814b7220388f7f2489d761ed45d38551f3216cbca21d04eaf044f3b) |
| Validators agreed the condition was met | `check_world` | [0x260029...eade](https://explorer-bradbury.genlayer.com/tx/0x260029e9318edf4145d33d70b3e6490df2679ed8bdbcc17547cc79f89793eade) |
| Released to recipient | `open_seal` | [0xe0458f...031](https://explorer-bradbury.genlayer.com/tx/0xe0458f1951e0a69eb234baab5d88dfcdbaa5ba6cfd20bec953c9516f6411f031) |

## What it is

Deadhand is a sealed-message vault that opens only when a real-world condition becomes true. A user writes something meant for later (a message, a bequest, a reveal, an instruction) and binds it to a condition stated in plain language, for example "When this company goes public" or "When this studio ships its 1.0 release". The message is committed behind a seal and stays held shut until public evidence confirms the condition has actually happened.

The trigger is an interpreted event, not a clock. This is not a time lock, not a vote, and not a dashboard. The author cannot open it early. The recipient cannot force it. Only agreement that the world has caught up melts the seal.

## Why it needs GenLayer

Deadhand is a condition oracle and a gatekeeper. A message is sealed and bound to a natural-language real-world condition. The load-bearing question is not "what time is it" but "did this real-world event actually happen, given messy public evidence". That judgment is subjective and reproducible, and no single server should own it.

The `check_world` call asks GenLayer validators to independently read the supplied public evidence and agree on whether the condition is met. Each validator reruns the interpretation, and only agreement melts the seal. Consensus makes the release canonical and tamper resistant: the author cannot open early, and the recipient cannot force it open.

Deterministic guards fence the interpretation so the model can never release a seal on weak, absent, or contradictory evidence:

- The condition is immutable once bound. `bind_condition` refuses to change a condition that is already set.
- Only the recipient opens, and only after release. `open_seal` is recipient-only and releasable-only.
- `check_world` is user-triggered and rate-limited (a coarse minimum interval between checks on one vault, measured by a caller-supplied clock).
- Validation is comparative, never byte-equality. Validators must agree on the boolean `met` and on a coarse closeness band (cold, warm, hot), and prose rationale is never required to match word for word.

## Contract

Read from `contracts/DeadhandContract.py`.

| Method | Kind | Purpose |
| --- | --- | --- |
| `seal` | write | Creates a sealed vault from a payload commitment, recipient, sigil, and condition visibility. |
| `bind_condition` | write | Binds the immutable natural-language condition. Once bound, it cannot change. |
| `check_world` | write (non-deterministic) | Validators read public evidence and must agree on `met` plus a closeness band before state advances. |
| `open_seal` | write | Recipient-only and releasable-only. Reveals the payload reference once and lands a ledger entry. |
| `entrust` | write | Transfers keeper rights to another address (author-only, before opening). |
| `get_summary` | view | Returns contract owner and vault, evidence, and opened counts. |
| `get_vault` | view | Returns a single vault view by id (private conditions shrouded from non-parties). |
| `get_vaults` | view | Returns a paginated list of vaults, newest first. |
| `get_evidence` | view | Returns the evidence snapshots recorded for a vault. |
| `get_ledger` | view | Returns a paginated list of opened-vault ledger entries. |

## Run locally

The app runs fully offline in mock mode by default (no wallet), backed by a mock adapter that mirrors the contract's evidence and state logic.

```
npm install
npm run dev
```

Contract checks (lint the Intelligent Contract and run the direct-mode tests):

```
genvm-lint check contracts/DeadhandContract.py --json
python -m pytest tests/direct/ -p gltest_direct -q
```

## Connecting a live contract

Contract mode is selected by environment variables read in `src/lib/genlayer/index.ts`:

```
NEXT_PUBLIC_DEADHAND_MODE=contract
NEXT_PUBLIC_DEADHAND_CONTRACT=0xA075679ad3004D87eEAf583CE60208f57Ee4D38F
NEXT_PUBLIC_DEADHAND_NETWORK=bradbury
```

The UI imports only the adapter interface, so swapping mock for contract touches no UI code.

## Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- Framer Motion
- Zustand
- genlayer-js

Shipped as a static export on Cloudflare Pages.
