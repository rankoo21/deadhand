// Live check against the deployed Deadhand contract. Exercises the sealing
// lifecycle: read the summary, seal a vault, bind a condition, and read it back.
//
//   node scripts/livecheck.mjs

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { studionet, testnetBradbury, localnet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

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

function pickChain(name) {
  switch ((name ?? "studionet").toLowerCase()) {
    case "bradbury":
    case "testnet-bradbury":
      return testnetBradbury;
    case "localnet":
      return localnet;
    default:
      return studionet;
  }
}

const g = (o, k) => (o && typeof o.get === "function" ? o.get(k) : o?.[k]);

let passed = 0;
let failed = 0;
function check(label, cond, extra = "") {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}  ${extra}`);
  }
}

async function main() {
  const env = { ...parseEnv(join(root, ".env.deploy")), ...parseEnv(join(root, ".env.local")) };
  const address = env.DEADHAND_CONTRACT_ADDRESS || env.NEXT_PUBLIC_DEADHAND_CONTRACT;
  const network = env.GENLAYER_NETWORK || env.NEXT_PUBLIC_DEADHAND_NETWORK || "studionet";
  if (!address) throw new Error("No contract address in env.");

  const chain = pickChain(network);
  const pk = env.GENLAYER_PRIVATE_KEY;
  const account = pk
    ? createAccount(pk.startsWith("0x") ? pk : `0x${pk}`)
    : createAccount(generatePrivateKey());
  const client = createClient({ chain, account });

  console.log(`Contract: ${address}`);
  console.log(`Network:  ${network}`);
  console.log(`Caller:   ${account.address}\n`);

  const wait = (hash) =>
    client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED, interval: 6000, retries: 150 });
  const read = (fn, args = []) => client.readContract({ address, functionName: fn, args });
  const write = async (fn, args) => {
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const h = await client.writeContract({ address, functionName: fn, args, value: 0n });
        return await wait(h);
      } catch (e) {
        lastErr = e;
        const msg = String(e?.message ?? e);
        if (!/revert|timed out|temporarily|429/i.test(msg)) throw e;
        await new Promise((r) => setTimeout(r, 8000));
      }
    }
    throw lastErr;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const readUntil = async (fn, args, pred, tries = 30, gap = 4000) => {
    let last;
    for (let i = 0; i < tries; i += 1) {
      last = await read(fn, args);
      if (pred(last)) return last;
      await sleep(gap);
    }
    return last;
  };

  console.log("Scenario: read summary, seal a vault, bind a condition, read it back");

  const summary0 = await read("get_summary", []);
  check("live read: summary available", g(summary0, "vaults") !== undefined, JSON.stringify(summary0));

  const nextIndex = Number(g(summary0, "vaults"));
  const vaultId = `vault_${nextIndex}`;

  await write("seal", [
    "When the record is broken",
    "sealed://livecheck-secret-reference",
    account.address,
    "hollowStar",
    "public",
    Date.now(),
  ]);
  let vault = await readUntil("get_vault", [vaultId], (v) => !!g(v, "id"));
  check("live read: vault sealed", g(vault, "state") === "sealed", `got ${g(vault, "state")}`);
  check("live read: keeper recorded", String(g(vault, "recipient")).toLowerCase() === account.address.toLowerCase());

  await write("bind_condition", [vaultId, "When the long-standing world record is officially broken.", Date.now()]);
  vault = await readUntil("get_vault", [vaultId], (v) => g(v, "conditionBound") === true);
  check("live read: condition bound", g(vault, "conditionBound") === true);
  check(
    "live read: condition text stored",
    String(g(vault, "conditionText")).includes("world record"),
    String(g(vault, "conditionText")),
  );

  const summary1 = await read("get_summary", []);
  console.log("Contract summary:", JSON.stringify(summary1, (k, v) => (typeof v === "bigint" ? Number(v) : v)));

  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("LIVECHECK ERROR:", e?.message ?? e);
  process.exit(1);
});
