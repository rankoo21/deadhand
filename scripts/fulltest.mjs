// Full live TestLens check. WARNING: this script performs exactly one
// submit_check contract write when explicitly run. It is not run by CI or local validation.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient, createAccount } from "genlayer-js";
import { studionet, testnetBradbury, localnet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseEnv(path) {
  const values = {};
  if (!existsSync(path)) return values;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const value = line.trim();
    if (!value || value.startsWith("#")) continue;
    const separator = value.indexOf("=");
    if (separator > 0) values[value.slice(0, separator).trim()] = value.slice(separator + 1).trim();
  }
  return values;
}

function pickChain(name) {
  switch ((name ?? "studionet").toLowerCase()) {
    case "bradbury": case "testnet-bradbury": case "testnetbradbury": return testnetBradbury;
    case "localnet": return localnet;
    default: return studionet;
  }
}

function plain(value) {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Map) return Object.fromEntries([...value].map(([key, item]) => [key, plain(item)]));
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  return value;
}

async function main() {
  const env = parseEnv(join(root, ".env.deploy"));
  const privateKey = env.GENLAYER_PRIVATE_KEY;
  const address = env.TESTLENS_CONTRACT_ADDRESS;
  const network = env.GENLAYER_NETWORK || "studionet";
  if (!privateKey) throw new Error("Missing GENLAYER_PRIVATE_KEY in .env.deploy.");
  if (!address) throw new Error("Missing TESTLENS_CONTRACT_ADDRESS in .env.deploy.");

  const account = createAccount(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);
  const client = createClient({ chain: pickChain(network), account });
  const requestId = `full-${Date.now().toString(36)}`;
  const payload = JSON.stringify({
    feature_requirement: "A project member can archive an active project, but a guest cannot and an archived project cannot be archived twice.",
    tests_summary: "test_member_archives_active_project\ntest_guest_cannot_archive\ntest_archive_rejects_already_archived_project\ntest_archive_returns_not_found",
    risk_context: "Archiving changes visibility and must preserve authorization boundaries.",
  });

  console.log("TestLens live end-to-end check");
  console.log("WARNING: exactly one contract write will be submitted.");
  console.log("Baseline summary:", JSON.stringify(plain(await client.readContract({ address, functionName: "get_summary", args: [] }))));
  const hash = await client.writeContract({ address, functionName: "submit_check", args: [requestId, payload, Date.now()], value: 0n });
  console.log(`Transaction hash: ${hash}`);
  const receipt = plain(await client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED, interval: 6000, retries: 150 }));
  if (receipt?.txExecutionResultName !== "FINISHED_WITH_RETURN") {
    throw new Error(`Contract execution failed: ${String(receipt?.txExecutionResultName ?? "unknown")}.`);
  }

  let result = null;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    result = plain(await client.readContract({ address, functionName: "get_result", args: [requestId, account.address] }));
    if (result?.request_id === requestId) break;
    await sleep(2000);
  }
  if (result?.request_id !== requestId) throw new Error("Canonical result was not readable before timeout.");

  console.log("Canonical result:", JSON.stringify(result, null, 2));
  console.log("Recent results:", JSON.stringify(plain(await client.readContract({ address, functionName: "get_results", args: [0, 5] })), null, 2));
  console.log("Final summary:", JSON.stringify(plain(await client.readContract({ address, functionName: "get_summary", args: [] }))));
}

main().catch((error) => { console.error("TestLens full check failed:", error?.message ?? error); process.exit(1); });