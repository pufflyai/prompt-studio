import { readFileSync } from "node:fs";

export const readRuntimeSecrets = (env: Record<string, string | undefined>) => {
  const trust = JSON.parse(env.RELAY_ACCESS_TRUST ?? readFileSync(env.RELAY_ACCESS_TRUST_FILE!, "utf8"));
  return { trust };
};
