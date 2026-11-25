import { expect, test } from "bun:test";
import type { ModelInfo } from "@github/copilot-sdk";
import { fakeCopilot, harnessContext } from "./copilot.fixture";
import { createCopilotHarness, toAgentModel } from "./harness";
import { createQuotasCommand, normalizeCopilotQuotas } from "./quotas";

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
  expect(
    toAgentModel({
      id: "gpt",
      name: "GPT",
      supportedReasoningEfforts: ["low", "medium", "high"],
      defaultReasoningEffort: "low",
    } as ModelInfo).paramOverrides?.reasoning,
  ).toMatchObject({ defaultValue: "medium" });
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
  const ctx = harnessContext();
  const [, bash] = await harness.getMessages(ctx, { agentSessionId: "source" });
  expect(await harness.fork(ctx, { agentSessionId: "source", messageId: bash!.id } as never)).toEqual({
    agentSessionId: "forked-session",
  });
  expect(copilot.calls).toContain(`fork:source:${recorded[6]?.id}`);
});

test("disabling the extension stops a turn that is still starting", async () => {
  const copilot = fakeCopilot(() => []);
  const starting = Promise.withResolvers<void>();
  copilot.client.start = () => starting.promise;
  copilot.client.forceStop = async () => {
    copilot.calls.push("forceStop");
    starting.reject(new Error("runtime stopped"));
  };
  const harness = createCopilotHarness(copilot.factory);
  const ctx = harnessContext();
  const session = harness.start(ctx, { prompt: "x", sessionId: "host", events: { getMessages: () => [], push() {} } });
  await harness.dispose(ctx);
  await expect(session).rejects.toThrow();
  // Stopped before or while the runtime starts: no Copilot session is ever created.
  expect(copilot.calls).not.toContain("create");
  expect(copilot.calls.filter((call) => call === "start" || call === "forceStop")).not.toEqual(["start"]);
});

test("quotas keep this device's token use when Copilot cannot report quotas", async () => {
  const copilot = fakeCopilot(() => []);
  copilot.client.getQuota = () => Promise.reject(new Error("not signed in"));
  const usage = {
    since: "2026-11-01T00:00:00.000Z",
    scope: "device" as const,
    inputTokens: 2_000,
    outputTokens: 10,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    nanoAiu: 0,
    models: [],
  };
  const command = createQuotasCommand(copilot.factory, async () => usage);
  expect(await command.run({ signal: new AbortController().signal } as never, {} as never)).toMatchObject({
    status: "unavailable",
    limits: [],
    usage: { inputTokens: 2_000 },
    message: expect.stringContaining("2K input"),
  });
});

test("the model list is empty, not an error, until the person signs in", async () => {
  const copilot = fakeCopilot(() => []);
  copilot.client.getAuthStatus = async () => ({ isAuthenticated: false });
  copilot.client.listModels = () => Promise.reject(new Error("Not authenticated. Please authenticate first."));
  const harness = createCopilotHarness(copilot.factory);
  expect(await harness.listModels(harnessContext())).toEqual([]);
});
