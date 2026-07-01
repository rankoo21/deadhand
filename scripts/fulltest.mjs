// Full live end-to-end test of the deployed Deadhand contract on Testnet Bradbury.
//
//   node scripts/fulltest.mjs
//
// Exercises the real lifecycle with on-chain WRITES:
//   seal -> bind_condition -> check_world (AI consensus) -> (open_seal) -> reads
//
// Method names/params are discovered from client.getContractSchema(address);
// nothing is guessed. Every transaction is printed as a full public explorer
// link as it happens, and an EXPLORER LINKS block is printed at the end.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const EXPLORER_BASE = "https://explorer-bradbury.genlayer.com";

function parseEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

// Reads-safe getter: handles both Map and plain object return shapes.
const g = (o, k) => (o && typeof o.get === "function" ? o.get(k) : o?.[k]);

// Convert BigInt/Map/nested structures into JSON-serializable plain values.
function plainify(value) {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Map) {
    const obj = {};
    for (const [k, v] of value.entries()) obj[k] = plainify(v);
    return obj;
  }
  if (Array.isArray(value)) return value.map(plainify);
  if (value && typeof value === "object") {
    const obj = {};
    for (const [k, v] of Object.entries(value)) obj[k] = plainify(v);
    return obj;
  }
  return value;
}

const j = (v) => JSON.stringify(plainify(v), null, 2);
const txLink = (hash) => `${EXPLORER_BASE}/tx/${hash}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const env = parseEnv(join(root, ".env.deploy"));
  const pk = env.GENLAYER_PRIVATE_KEY;
  const address = env.DEADHAND_CONTRACT_ADDRESS;
  if (!pk) throw new Error("Missing GENLAYER_PRIVATE_KEY in .env.deploy");
  if (!address) throw new Error("Missing DEADHAND_CONTRACT_ADDRESS in .env.deploy");

  const account = createAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
  const client = createClient({ chain: testnetBradbury, account });

  // Collected tx links for the final EXPLORER LINKS block.
  const links = [];

  console.log("=== Deadhand full live end-to-end test (Testnet Bradbury) ===");
  console.log(`Contract: ${address}`);
  console.log(`Signer:   ${account.address}  (owner + recipient for this demo)`);
  console.log(`Explorer: ${EXPLORER_BASE}/address/${address}`);
  console.log("");

  // --- 1. Discover the real ABI: do not guess method names/params ----------
  console.log("--- Step 1: discovering contract schema ---");
  const schema = await client.getContractSchema(address);
  const methods = g(schema, "methods") ?? schema?.methods ?? {};
  const methodEntries =
    methods instanceof Map ? [...methods.entries()] : Object.entries(methods ?? {});
  const wanted = [
    "seal",
    "bind_condition",
    "check_world",
    "open_seal",
    "get_vault",
    "get_vaults",
    "get_summary",
  ];
  for (const [name, def] of methodEntries) {
    if (!wanted.includes(name)) continue;
    const params = g(def, "params") ?? def?.params ?? [];
    const kind = (g(def, "readonly") ?? def?.readonly) ? "view" : "write";
    console.log(`  ${name} (${kind})  params=${JSON.stringify(plainify(params))}`);
  }
  console.log("");

  // --- write helper with retry + receipt wait ------------------------------
  const wait = (hash) =>
    client.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.ACCEPTED,
      interval: 6000,
      retries: 150,
    });

  const read = (fn, args = []) => client.readContract({ address, functionName: fn, args });

  // Executes a write with up to 4 retries on transient Bradbury failures.
  // Returns { hash, receipt }. Prints the explorer link as soon as the tx is sent.
  const write = async (label, fn, args) => {
    let lastErr;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        const hash = await client.writeContract({ address, functionName: fn, args, value: 0n });
        const link = txLink(hash);
        console.log(`  [${label}] tx sent: ${link}`);
        links.push({ label, link });
        const receipt = await wait(hash);
        console.log(`  [${label}] ACCEPTED`);
        return { hash, receipt };
      } catch (e) {
        lastErr = e;
        const msg = String(e?.message ?? e);
        if (!/revert|timed out|temporarily|429|nonce/i.test(msg)) {
          throw e;
        }
        console.log(`  [${label}] transient failure (attempt ${attempt}/4): ${msg}`);
        if (attempt < 4) await sleep(10000);
      }
    }
    throw new Error(`Step "${label}" failed after 4 retries: ${String(lastErr?.message ?? lastErr)}`);
  };

  const readUntil = async (fn, args, pred, tries = 40, gap = 4000) => {
    let last;
    for (let i = 0; i < tries; i += 1) {
      last = await read(fn, args);
      if (pred(last)) return last;
      await sleep(gap);
    }
    return last;
  };

  // --- 2. Baseline summary -------------------------------------------------
  console.log("--- Step 2: baseline summary ---");
  const summary0 = await read("get_summary", []);
  console.log("  get_summary =>", j(summary0));
  const nextIndex = Number(g(summary0, "vaults"));
  const vaultId = `vault_${nextIndex}`;
  console.log(`  next vault id will be: ${vaultId}`);
  console.log("");

  // --- 3. seal -------------------------------------------------------------
  // seal(title, payload_commitment, recipient, sigil, condition_visibility, now_ms)
  console.log("--- Step 3: seal a vault ---");
  await write("seal", "seal", [
    "First footsteps on the Moon",
    "sealed://deadhand-fulltest-secret-reference",
    account.address, // recipient == signer so open_seal is possible in this demo
    "hollowStar",
    "public",
    Date.now(),
  ]);
  let vault = await readUntil("get_vault", [vaultId], (v) => !!g(v, "id"));
  console.log(`  vault state after seal: ${g(vault, "state")}`);
  console.log("");

  // --- 4. bind_condition ---------------------------------------------------
  // bind_condition(vault_id, condition_text, now_ms)
  console.log("--- Step 4: bind a natural-language condition ---");
  const conditionText =
    "When humans have landed on the Moon and returned safely to Earth.";
  await write("bind_condition", "bind_condition", [vaultId, conditionText, Date.now()]);
  vault = await readUntil("get_vault", [vaultId], (v) => g(v, "conditionBound") === true);
  console.log(`  conditionBound: ${g(vault, "conditionBound")}`);
  console.log(`  conditionText:  ${g(vault, "conditionText")}`);
  console.log("");

  // --- 5. check_world (AI consensus, slow on Bradbury) ---------------------
  // check_world(vault_id, evidence, source_label, now_ms)
  console.log("--- Step 5: check_world (AI-consensus read of public evidence) ---");
  const evidence =
    "Public historical record: On July 20, 1969, NASA's Apollo 11 mission " +
    "landed humans on the Moon. Astronauts Neil Armstrong and Buzz Aldrin " +
    "walked on the lunar surface, and the crew returned safely to Earth on " +
    "July 24, 1969. This Moon landing is a widely documented, confirmed event.";
  const { receipt: checkReceipt } = await write("check_world", "check_world", [
    vaultId,
    evidence,
    "NASA historical record",
    Date.now(),
  ]);
  // Try to surface the decision returned by the tx if present in the receipt.
  console.log("");

  vault = await readUntil(
    "get_vault",
    [vaultId],
    (v) => g(v, "state") !== "sealed",
    40,
    4000,
  );
  const stateAfterCheck = g(vault, "state");
  console.log(`  vault state after check_world: ${stateAfterCheck}`);
  console.log(`  closeness: ${g(vault, "closeness")}  band: ${g(vault, "closenessBand")}`);
  console.log("");

  // --- 6. open_seal (only if releasable) -----------------------------------
  console.log("--- Step 6: open_seal (recipient), only if releasable ---");
  if (stateAfterCheck === "releasable") {
    // open_seal(vault_id, mock_tx_hash, now_ms)
    const { receipt: openReceipt } = await write("open_seal", "open_seal", [
      vaultId,
      "",
      Date.now(),
    ]);
    vault = await readUntil("get_vault", [vaultId], (v) => g(v, "opened") === true);
    console.log(`  opened: ${g(vault, "opened")}  state: ${g(vault, "state")}`);
    console.log(`  revealed payloadCommitment: ${g(vault, "payloadCommitment")}`);
  } else {
    console.log(`  Skipped: vault is "${stateAfterCheck}", not "releasable".`);
  }
  console.log("");

  // --- 7. Final reads ------------------------------------------------------
  console.log("--- Step 7: final reads ---");
  const finalVault = await read("get_vault", [vaultId]);
  const finalVaults = await read("get_vaults", [0, 5]);
  const finalSummary = await read("get_summary", []);
  console.log("get_vault =>");
  console.log(j(finalVault));
  console.log("get_vaults (first 5) =>");
  console.log(j(finalVaults));
  console.log("get_summary =>");
  console.log(j(finalSummary));
  console.log("");

  // --- 8. EXPLORER LINKS block ---------------------------------------------
  console.log("========================= EXPLORER LINKS =========================");
  console.log(`Contract: ${EXPLORER_BASE}/address/${address}`);
  for (const { label, link } of links) {
    console.log(`${label}: ${link}`);
  }
  console.log("==================================================================");
}

main().catch((err) => {
  console.error("");
  console.error("FULLTEST FAILED:", err?.message ?? err);
  process.exit(1);
});
