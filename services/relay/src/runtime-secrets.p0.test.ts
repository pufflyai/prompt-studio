import { expect, test } from "bun:test";
import { readRuntimeSecrets } from "./runtime-secrets";

test("relay accepts public trust and a recovery key injected without a filesystem", () => {
  const trust = { issuer: "https://manager.test", audience: "https://relay.test", jwks: { keys: [] } };
  const key = Buffer.alloc(32, 42);
  expect(
    readRuntimeSecrets({ RELAY_ACCESS_TRUST: JSON.stringify(trust), RELAY_RECOVERY_KEY: key.toString("base64") }),
  ).toEqual({ trust, recoveryKey: key });
});

test("relay rejects a malformed injected recovery key", () => {
  expect(() => readRuntimeSecrets({ RELAY_ACCESS_TRUST: "{}", RELAY_RECOVERY_KEY: "invalid" })).toThrow();
});
