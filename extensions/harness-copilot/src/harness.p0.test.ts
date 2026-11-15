import { expect, test } from "bun:test";
import type { ModelInfo } from "@github/copilot-sdk";
import { fakeCopilot } from "./copilot.fixture";
import { createCopilotHarness, toAgentModel } from "./harness";
import { normalizeCopilotQuotas } from "./quotas";

test("models expose only the reasoning efforts Copilot supports for them", () => {
  const reasoning = toAgentModel({
    id: "gpt-6-luna",
    name: "GPT-6 Luna",
    supportedReasoningEfforts: ["low", "high"],
    defaultReasoningEffort: "low",
  } as ModelInfo);
  expect(reasoning.paramOverrides?.reasoning).toMatchObject({
    defaultValue: "low",
    options: [
      { label: "Default", value: "default" },
      { label: "Low", value: "low" },
      { label: "High", value: "high" },
    ],
  });
  expect(toAgentModel({ id: "auto", name: "Auto" } as ModelInfo).paramOverrides).toEqual({ reasoning: null });
});

test("quotas report limited buckets and explain token-billed plans", () => {
  const limited = normalizeCopilotQuotas({
    premium_interactions: { isUnlimitedEntitlement: false, remainingPercentage: 42, resetDate: "2026-12-01T00:00:00Z" },
    chat: { isUnlimitedEntitlement: true, remainingPercentage: 100 },
  } as never);
  expect(limited).toMatchObject({
    status: "available",
    limits: [
      {
        id: "premium_interactions",
        label: "Premium requests",
        remainingPercent: 42,
        resetsAt: "2026-12-01T00:00:00.000Z",
      },
    ],
  });
  expect(
    normalizeCopilotQuotas({
      chat: { isUnlimitedEntitlement: true, remainingPercentage: 100, tokenBasedBilling: true },
    } as never),
  ).toMatchObject({ status: "unsupported", limits: [] });
});

test("forking reads saved history and cuts it after the chosen message", async () => {
  const { default: recorded } = await import("./fixtures/live-turn.json");
  const copilot = fakeCopilot(() => []);
  copilot.client.readEvents = async () => recorded as never;
  const harness = createCopilotHarness(copilot.factory);
  const ctx = { logger: { warn() {} } } as never;
  const [, bash] = await harness.getMessages(ctx, { agentSessionId: "source" });
  expect(await harness.fork(ctx, { agentSessionId: "source", messageId: bash!.id } as never)).toEqual({
    agentSessionId: "forked-session",
  });
  expect(copilot.calls).toContain(`fork:source:${recorded[6]?.id}`);
});
