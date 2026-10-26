import { expect, test } from "bun:test";
import { createAutomationApi } from "./automation";

test("binds the caller project and extension and resolves local command refs lazily", async () => {
  const calls: unknown[] = [];
  const owner = { projectId: "project", extensionId: "example.worker" };
  let ready = false;
  const api = createAutomationApi(() => {
    expect(ready).toBe(true);
    return {
      enqueueForExtension: async (input: unknown) => {
        calls.push(input);
        return { id: "run" };
      },
      getForExtension: async (...args: unknown[]) => {
        calls.push(args);
      },
      listForExtension: async (...args: unknown[]) => {
        calls.push(args);
        return [];
      },
      cancelForExtension: async (...args: unknown[]) => {
        calls.push(args);
        return { id: "run" };
      },
    } as never;
  }, owner);
  ready = true;
  await api.enqueue({ command: { kind: "command", id: "run" }, input: {}, key: "key" });
  await api.get("run");
  await api.list({ status: ["running"] });
  await api.cancel("run");
  expect(calls).toEqual([
    { ...owner, commandId: "example.worker.command.run", input: {}, key: "key" },
    [owner, "run"],
    [owner, { status: ["running"] }],
    [owner, "run"],
  ]);
});
