import { expect, test } from "bun:test";
import { defaultRelayLimits, readRelayLimits } from "./limits";

test("the grace period defaults to seven days and operators can change it", () => {
  expect(readRelayLimits({}).gracePeriodMs).toBe(7 * 24 * 60 * 60 * 1000);
  expect(readRelayLimits({ RELAY_GRACE_PERIOD_SECONDS: "60" })).toEqual({
    ...defaultRelayLimits,
    gracePeriodMs: 60_000,
  });
});

test("invalid operator limits stop the relay from starting", () => {
  expect(() => readRelayLimits({ RELAY_MAX_UPDATE_BYTES: "1.5" })).toThrow("RELAY_MAX_UPDATE_BYTES");
  expect(() => readRelayLimits({ RELAY_ACCOUNT_QUOTA_BYTES: "" })).toThrow("RELAY_ACCOUNT_QUOTA_BYTES");
});
