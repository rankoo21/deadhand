// Live TestLens smoke check. WARNING: this script performs exactly one
// submit_check contract write when explicitly run. It is not part of local validation.
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
  const chain = pickChain(network);
  const client = createClient({ chain, account });
  const requestId = `live-${Date.now().toString(36)}`;
  const payload = JSON.stringify({
    feature_requirement: "A signed-in editor can publish a valid draft, while viewers cannot publish.",
    tests_summary: "test_editor_can_publish_valid_draft\ntest_viewer_cannot_publish",
    risk_context: "Publishing permissions must be enforced.",
  });

  console.log("WARNING: submitting exactly one live TestLens write.");
  console.log(`Contract: ${address}`);
  console.log(`Network: ${network}`);
  console.log(`Request: ${requestId}`);
  const hash = await client.writeContract({ address, functionName: "submit_check", args: [requestId, payload, Date.now()], value: 0n });
  console.log(`Transaction: ${hash}`);
  const receipt = await client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED, interval: 6000, retries: 150 });
  const receiptData = plain(receipt);
  if (receiptData?.txExecutionResultName !== "FINISHED_WITH_RETURN") {
    throw new Error(`Contract execution failed: ${String(receiptData?.txExecutionResultName ?? "unknown")}.`);
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = plain(await client.readContract({ address, functionName: "get_result", args: [requestId, account.address] }));
    if (result?.request_id === requestId) {
      console.log("Canonical result:", JSON.stringify(result, null, 2));
      return;
    }
    await sleep(2000);
  }
  throw new Error("Transaction accepted, but canonical result was not readable before timeout.");
}

main().catch((error) => { console.error("TestLens live check failed:", error?.message ?? error); process.exit(1); });