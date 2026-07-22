// Deploy TestLensContract to a configured GenLayer network.
// This script reads .env.deploy when explicitly run. Never commit that file.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient, createAccount } from "genlayer-js";
import { studionet, testnetBradbury, localnet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.deploy");
const contractPath = join(root, "contracts", "TestLensContract.py");

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

async function main() {
  const env = parseEnv(envPath);
  const privateKey = env.GENLAYER_PRIVATE_KEY;
  if (!privateKey) throw new Error("Missing GENLAYER_PRIVATE_KEY in .env.deploy.");
  const network = env.GENLAYER_NETWORK || "studionet";
  const account = createAccount(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);
  const options = { chain: pickChain(network), account };
  if (env.GENLAYER_RPC_URL) options.endpoint = env.GENLAYER_RPC_URL;
  const client = createClient(options);
  console.log(`Network: ${network}`);
  console.log(`Deployer: ${account.address}`);
  console.log("Deploying TestLensContract...");
  const hash = await client.deployContract({ code: readFileSync(contractPath), args: [] });
  console.log(`Deploy transaction: ${hash}`);
  const receipt = await client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED, interval: 6000, retries: 150 });
  const address = receipt?.data?.contract_address ?? receipt?.contract_address ?? receipt?.data?.contractAddress ?? receipt?.contractAddress ?? receipt?.recipient ?? receipt?.to_address;
  if (!address) throw new Error("Deployment was accepted but the receipt has no contract address.");
  console.log(`TestLensContract address: ${address}`);
  console.log("Configure the frontend with NEXT_PUBLIC_TESTLENS_MODE, NEXT_PUBLIC_TESTLENS_CONTRACT, and NEXT_PUBLIC_TESTLENS_NETWORK.");
}

main().catch((error) => { console.error("Deployment failed:", error?.message ?? error); process.exit(1); });
