// Confirms reads work with NO wallet: creates an account-less client and calls
// the get_summary view, exactly as the frontend read path does.
import fs from "node:fs";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) ?? [])[1]?.trim();
const address = get("NEXT_PUBLIC_DEADHAND_CONTRACT");

const client = createClient({ chain: studionet }); // no account, read-only
const raw = await client.readContract({ address, functionName: "get_summary", args: [] });
const plain = raw instanceof Map ? Object.fromEntries(raw) : raw;
console.log("read ok (no wallet). get_summary =>", JSON.stringify(plain, (_k, v) => (typeof v === "bigint" ? Number(v) : v)));
