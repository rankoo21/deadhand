<div align="center">

# Deadhand

Some words should wait for the world.

[![Network](https://img.shields.io/badge/Network-GenLayer_Bradbury-8b0000?style=flat-square)](https://explorer-bradbury.genlayer.com/address/0x9609634A80b12cD46feB96223667E2c42FBeef5a)
[![chainId](https://img.shields.io/badge/chainId-4221-2d2d2d?style=flat-square)](https://explorer-bradbury.genlayer.com)
[![Status](https://img.shields.io/badge/Status-live-2e7d32?style=flat-square)](https://deadhand.pages.dev)
[![Contract](https://img.shields.io/badge/Contract-Python_GenVM-3776ab?style=flat-square)](contracts/DeadhandContract.py)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js-000000?style=flat-square)](https://nextjs.org)

</div>

## On-chain proof

- **Contract:** [`0x9609634A80b12cD46feB96223667E2c42FBeef5a`](https://explorer-bradbury.genlayer.com/address/0x9609634A80b12cD46feB96223667E2c42FBeef5a)
- **Live app:** [deadhand.pages.dev](https://deadhand.pages.dev)
- **Validation:** `genvm-lint` passes; **32 direct tests pass**.
- **Persisted state:** 1 vault, 1 evidence record, 0 opened vaults.

| Action | Bradbury proof |
| --- | --- |
| Seal encrypted commitment | [`0x2ad43327...9d0f98`](https://explorer-bradbury.genlayer.com/tx/0x2ad433273ea6f87c593ec96145f0e17e30674c83b004fd90afbbb518f59d0f98) |
| Bind public condition | [`0x2e0993e6...845723a`](https://explorer-bradbury.genlayer.com/tx/0x2e0993e67b0d47085f2140debd1a8555fb0a3caeb23c71dcb4fbb6c19845723a) |
| Independently fetch and check evidence | [`0x44f9ce14...81a397`](https://explorer-bradbury.genlayer.com/tx/0x44f9ce14de0d02705719f9f0df95684a490589a70aa0f57815093b96c981a397) |

### Reviewer remediation

Plaintext payloads are structurally rejected. Deadhand accepts AES-GCM commitment envelopes, hash-only envelopes, and content-addressed `ipfs://` or `ar://` references. The **payload is private; the release condition is public** so validators can verify it. `check_world(vault_id, source_uri, source_label, now_ms)` makes each validator independently fetch a public HTTPS source and stores its URI, label, and fetched snapshot. The live vault correctly remained `listening` because its deterministic release gate did not pass, so no release is claimed.

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
NEXT_PUBLIC_DEADHAND_CONTRACT=0x9609634A80b12cD46feB96223667E2c42FBeef5a
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
