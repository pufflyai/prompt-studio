import { readFileSync } from "node:fs";

export const readRuntimeSecrets = (env: Record<string, string | undefined>) => {
  const trust = JSON.parse(env.RELAY_ACCESS_TRUST ?? readFileSync(env.RELAY_ACCESS_TRUST_FILE!, "utf8"));
  const recoveryKey = env.RELAY_RECOVERY_KEY
    ? Buffer.from(env.RELAY_RECOVERY_KEY, "base64")
    : readFileSync(env.RELAY_RECOVERY_KEY_FILE!);
  if (recoveryKey.byteLength !== 32) throw new Error("Relay recovery requires a 256-bit key");
  return { trust, recoveryKey };
};
