# TestLens

TestLens compares a feature requirement with a supplied tests summary and returns a grounded coverage assessment across happy paths, errors, permissions, and edge cases. It is a one-page Next.js application backed by a GenLayer intelligent contract.

The application has two explicit modes:

- **Preview mode** runs a deterministic local interface example. It uses no wallet or network and makes no consensus or canonical-state claim.
- **Contract mode** submits one `submit_check` write, waits for validator consensus, verifies successful execution, and reads the persisted result from the contract.

## Consensus boundary

The contract asks the leader and validators to independently compare only the submitted requirement, test summary, and optional risk context. They must agree on the stable decision fields:

- overall verdict
- confidence
- status for each of the four coverage categories

Explanatory prose and evidence wording do not need byte-for-byte equality. The contract normalizes model output, grounds evidence in literal test-summary lines, rejects malformed decisions, and persists only an agreed result.

No external URL, API, repository, or unstated fact is part of the assessment. Missing evidence is treated as missing coverage.

## Contract

The canonical contract is [`contracts/TestLensContract.py`](contracts/TestLensContract.py). It pins a concrete GenVM runner hash.

| Method | Kind | Purpose |
| --- | --- | --- |
| `submit_check(request_id, payload_json, now_ms)` | write | Validates input, runs comparative validator analysis, and persists one result per sender and request ID. |
| `get_result(request_id, sender)` | view | Reads one canonical result. An empty sender uses the caller. |
| `get_results(offset, limit)` | view | Reads newest results first with a maximum page size of 20. |
| `get_summary()` | view | Returns total and per-verdict counts. |

The JSON payload accepted by `submit_check` is:

```json
{
  "feature_requirement": "A signed-in editor can publish a valid draft.",
  "tests_summary": "test_editor_can_publish_valid_draft",
  "risk_context": "Publishing permissions must be enforced."
}
```

`risk_context` is optional context for strictness. It is never treated as test evidence.

## Run locally

Requirements are Node.js, Python, the direct-test plugin, and `genvm-lint`. Existing dependencies are sufficient.

```bash
npm install
npm run dev
```

Preview mode is the default when no frontend environment is configured.

## Frontend configuration

Copy `.env.example` to `.env.local` and use TestLens variables only:

```dotenv
NEXT_PUBLIC_TESTLENS_MODE=contract
NEXT_PUBLIC_TESTLENS_CONTRACT=0xYourContractAddress
NEXT_PUBLIC_TESTLENS_NETWORK=bradbury
```

Supported networks are `studionet`, `bradbury`, and `localnet`. Contract mode requires MetaMask with the GenLayer Snap for writes. Read calls use a separate read-only client with a generated, unfunded account.

## Transaction safety and recovery

The browser adapter creates two distinct client instances:

- `readClient` is immutable and used only for contract views.
- `walletClient` is created after wallet connection and used only for the one write and receipt inspection.

There is exactly one `writeContract` call in the frontend adapter. As soon as it returns, TestLens stores an immutable pending record in local storage with:

- `app: "testlens"`
- request ID
- transaction hash
- submitting account
- submission timestamp

A refresh or timeout recovers that same hash. TestLens never automatically resubmits a pending write. Recovery requires the same wallet account, verifies accepted transaction status and `FINISHED_WITH_RETURN`, then polls `get_result` through the read client until canonical state is available. The interface exposes the transaction explorer link when the selected chain provides one.

Malformed pending records and records from another app are rejected rather than migrated or silently masked.

## Validation

Run the full local validation set:

```bash
npm run contract:lint
npm run test:direct
npm run typecheck
npm run build
```

Equivalent direct commands are:

```bash
genvm-lint check contracts/TestLensContract.py --json
python -m pytest tests/direct/ -p gltest_direct -q
node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
node ./node_modules/next/dist/bin/next build
```

Direct tests mock nondeterministic model responses and cover normalized persistence, request and payload validation, field boundaries, duplicate IDs per sender, pagination, summary counts, malformed model output, and comparative validator agreement.

## Operational scripts

- `scripts/deploy.mjs` deploys `TestLensContract.py` only when explicitly run.
- `scripts/readcheck.mjs` performs a read-only `get_summary` smoke check using `.env.local`.
- `scripts/livecheck.mjs` and `scripts/fulltest.mjs` each print a warning and perform exactly one live `submit_check` write when explicitly run. They are not part of local validation.

Deployment and live-write scripts read ignored environment files. Do not commit private keys or secret values. This repository does not claim a deployment, live contract address, or live transaction proof unless independently supplied and verified.

## Stack

- Next.js 14 and React 18
- TypeScript
- Tailwind CSS and custom CSS
- Framer Motion with reduced-motion handling
- genlayer-js
- Python intelligent contract with GenLayer direct tests

The Next.js application uses static export and can be hosted without a server runtime.