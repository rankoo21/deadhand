// Read-only smoke check for the configured TestLens contract.
// Uses an unfunded generated account only to satisfy genlayer-js read calls.
import fs from "node:fs";
import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { studionet, testnetBradbury, localnet } from "genlayer-js/chains";

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const get = (key) => (env.match(new RegExp(`^${key}=(.*)$`, "m")) ?? [])[1]?.trim();
const address = get("NEXT_PUBLIC_TESTLENS_CONTRACT");
const network = (get("NEXT_PUBLIC_TESTLENS_NETWORK") ?? "studionet").toLowerCase();
if (!address) throw new Error("Missing NEXT_PUBLIC_TESTLENS_CONTRACT in .env.local.");

function pickChain(name) {
  switch (name) {
    case "bradbury":
    case "testnet-bradbury":
    case "testnetbradbury":
      return testnetBradbury;
    case "localnet":
      return localnet;
    default:
      return studionet;
  }
}

function plain(value) {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Map) return Object.fromEntries([...value].map(([key, item]) => [key, plain(item)]));
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  return value;
}

const account = createAccount(generatePrivateKey());
const client = createClient({ chain: pickChain(network), account });
const raw = await client.readContract({ address, functionName: "get_summary", args: [] });
console.log(`TestLens read ok (${network}). get_summary =>`, JSON.stringify(plain(raw)));