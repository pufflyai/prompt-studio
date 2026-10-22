import { expect, test } from "bun:test";
import { createCodexHarness } from "./harness";
import { peer, sink } from "./shared-server-peer";

test("offers Standard and Fast speed independently from reasoning effort", () => {
  expect(createCodexHarness().params?.service_tier).toMatchObject({
    type: "select",
    label: "Speed",
    defaultValue: "default",
    options: [
      { label: "Standard", value: "default" },
      { label: "Fast", value: "fast" },
    ],
  });
});

for (const method of ["thread/start", "thread/resume"]) {
  test(`sets Fast speed on ${method} and switches a warm session back to Standard`, async () => {
    const { runtime, calls, children } = peer();
    const input = {
      prompt: "hello",
      events: sink(),
      env: { PSTDIO_SESSION_ID: method },
      ...(method === "thread/resume" ? { agentSessionId: "existing" } : {}),
    };
    try {
      const first = await runtime.run({ ...input, params: { service_tier: "fast" } });
      expect(calls.find((call) => call.method === method)?.params.serviceTier).toBe("fast");
      expect(calls.find((call) => call.method === "turn/start")?.params.serviceTier).toBe("fast");
      children[0].emit({
        method: "turn/completed",
        params: { threadId: first.agentSessionId, turn: { id: "turn-1", status: "completed" } },
      });
      await first.done;
      const next = await runtime.run({
        ...input,
        agentSessionId: first.agentSessionId,
        params: { service_tier: "default" },
      });
      expect(calls.filter((call) => call.method === method)).toHaveLength(1);
      expect(calls.filter((call) => call.method === "turn/start").at(-1)?.params.serviceTier).toBe("default");
      await next.stop();
    } finally {
      await runtime.dispose();
    }
  });
}

test("inherits native speed when no speed override is supplied", async () => {
  const { runtime, calls } = peer();
  try {
    const session = await runtime.run({ prompt: "hello", events: sink() });
    expect(calls.find((call) => call.method === "thread/start")?.params).not.toHaveProperty("serviceTier");
    expect(calls.find((call) => call.method === "turn/start")?.params).not.toHaveProperty("serviceTier");
    await session.stop();
  } finally {
    await runtime.dispose();
  }
});

test("applies the selected speed before starting a goal on a warm Fast thread", async () => {
  const { runtime, calls } = peer();
  const input = { prompt: "hello", events: sink(), env: { PSTDIO_SESSION_ID: "speed-goal" } };
  try {
    const first = await runtime.run({ ...input, params: { service_tier: "fast" } });
    await first.stop();
    const goal = await runtime.run(
      { ...input, agentSessionId: first.agentSessionId, params: { service_tier: "default" } },
      { method: "thread/goal/set", params: { objective: "Finish the task" }, goal: true },
    );
    const settings = calls.findIndex((call) => call.method === "thread/settings/update");
    expect(settings).toBeGreaterThan(-1);
    expect(calls[settings].params).toEqual({ threadId: first.agentSessionId, serviceTier: "default" });
    expect(calls.findIndex((call) => call.method === "thread/goal/set")).toBeGreaterThan(settings);
    expect(calls.filter((call) => call.method === "turn/start")).toHaveLength(1);
    await goal.stop();
  } finally {
    await runtime.dispose();
  }
});

test("cancelling while speed is acknowledged cannot start a goal afterward", async () => {
  const { runtime, calls, holdNext } = peer();
  const input = { prompt: "hello", events: sink(), env: { PSTDIO_SESSION_ID: "cancel-speed-goal" } };
  try {
    const first = await runtime.run(input);
    await first.stop();
    const settings = holdNext("thread/settings/update");
    const abort = new AbortController();
    const next = runtime.run(
      { ...input, agentSessionId: first.agentSessionId, params: { service_tier: "fast" }, signal: abort.signal },
      { method: "thread/goal/set", params: { objective: "Finish the task" }, goal: true },
    );
    await settings.requested;
    abort.abort();
    settings.reply();
    await expect(next).rejects.toMatchObject({ name: "AbortError" });
    expect(calls.filter((call) => call.method === "thread/goal/set")).toHaveLength(0);
  } finally {
    await runtime.dispose();
  }
});
