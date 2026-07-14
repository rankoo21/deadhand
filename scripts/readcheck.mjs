// Confirms reads work exactly as the fixed frontend read path does: a client
// that ALWAYS carries an account (an unfunded burner), so genlayer-js never
// throws "No account set...". Reads get_summary on the configured network.
import fs from "node:fs";
import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { studionet, testnetBradbury, localnet } from "genlayer-js/chains";

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) ?? [])[1]?.trim();
const address = get("NEXT_PUBLIC_DEADHAND_CONTRACT");
const network = (get("NEXT_PUBLIC_DEADHAND_NETWORK") ?? "studionet").toLowerCase();

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

// The read burner: unfunded, used only to satisfy the read path.
const account = createAccount(generatePrivateKey());
const client = createClient({ chain: pickChain(network), account });
const raw = await client.readContract({ address, functionName: "get_summary", args: [] });
const plain = raw instanceof Map ? Object.fromEntries(raw) : raw;
console.log(
  `read ok (burner account, ${network}). get_summary =>`,
  JSON.stringify(plain, (_k, v) => (typeof v === "bigint" ? Number(v) : v)),
);
