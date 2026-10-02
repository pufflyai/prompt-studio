import { expect, test } from "bun:test";
import type { HarnessContext, HarnessProvider } from "pstdio-api-contracts/extension-kernel";
import type { RuntimeHarnessRecord } from "pstdio-extensions";
import { createHarnessRegistry } from "./harness-registry";

const record = (id: string, mode: boolean): RuntimeHarnessRecord => ({
  id: `test.${id}.harness.native`,
  localId: "native",
  extensionId: `test.${id}`,
  name: id,
  sourcePath: `/extensions/${id}`,
  provider: {
    id: "native",
    ref: { kind: "harness", id: "native" },
    label: id,
    capabilities: () => [],
    start: () => ({ done: Promise.resolve({ status: "completed" }), stop: () => {} }),
    resume: () => ({ done: Promise.resolve({ status: "completed" }), stop: () => {} }),
    getCommandState: () => ({
      commands: [],
      modes: mode ? [{ id: "goal", label: "Goal", description: "An objective", state: "active", actions: [] }] : [],
      slashCommands: true,
    }),
    prepareOperation: (_ctx, _input, op) => ({
      execution: "control",
      invoke: async () => ({ kind: "completed", message: op.kind === "command" ? op.text : op.actionId }),
    }),
  } satisfies HarnessProvider,
});
test("same-spelling and unlisted commands preserve each harness meaning and raw input", async () => {
  const registry = createHarnessRegistry([record("one", true), record("two", false)], () => ({}) as HarnessContext);
  const input = { sessionId: "session" };
  const one = registry.list()[0];
  const two = registry.list()[1];
  expect((await one.getCommandState(input)).modes).toHaveLength(1);
  expect((await two.getCommandState(input)).modes).toHaveLength(0);
  const prepared = await two.prepareOperation(input, { kind: "command", text: "/goal  native arguments" });
  expect(await prepared.invoke({ events: { getMessages: () => [], push: () => {} } })).toEqual({
    kind: "completed",
    message: "/goal  native arguments",
  });
  await registry.dispose();
});

test("native command runs use the same terminal failure contract as ordinary turns", async () => {
  const native = record("failure", false);
  native.provider.prepareOperation = () => ({
    execution: "exclusive",
    invoke: async () => ({
      kind: "started",
      session: { done: Promise.reject(new Error("native failure")), stop: () => {} },
    }),
  });
  const registry = createHarnessRegistry([native], () => ({}) as HarnessContext);
  try {
    const prepared = await registry
      .list()[0]
      .prepareOperation({ sessionId: "session" }, { kind: "command", text: "/run" });
    const result = await prepared.invoke({ events: { getMessages: () => [], push: () => {} } });
    expect(result.kind).toBe("started");
    if (result.kind === "started") expect(await result.session.done).toEqual({ status: "failed" });
  } finally {
    await registry.dispose();
  }
});
