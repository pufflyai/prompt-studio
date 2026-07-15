import { describe, expect, test } from "bun:test";
import { automationPolicyCommand } from "./automation-policy";

describe("automationPolicyCommand", () => {
  test("returns the configured in-progress cap", async () => {
    const result = await automationPolicyCommand.run({ settings: { get: async () => 4 } } as never);
    expect(result).toEqual({ maxInProgress: 4 });
  });

  test("allows automation to be paused with a zero cap", async () => {
    const result = await automationPolicyCommand.run({ settings: { get: async () => 0 } } as never);
    expect(result).toEqual({ maxInProgress: 0 });
  });

  test("falls back to two for an invalid value", async () => {
    const result = await automationPolicyCommand.run({ settings: { get: async () => "invalid" } } as never);
    expect(result).toEqual({ maxInProgress: 2 });
  });
});
