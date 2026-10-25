import { expect, test } from "bun:test";
import { eventRef } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { createCommandRunner } from "./runner";
import { buildRuntime, stubEnvironment } from "./runner.test-fixture";

test("extension events keep the emitting workbench storage owner and preserve their payload", async () => {
  const changed = eventRef<{ projectId?: string; workspaceId?: string; value: string }>({
    extensionId: "pstdio.lab",
    id: "changed",
  });
  const projected = eventRef<{ value: string }>({ extensionId: "pstdio.lab", id: "projected" });
  const stores = new Map<string, ReturnType<typeof createMemoryStorage>>();
  const payloads: unknown[] = [];
  const contexts: unknown[] = [];
  const runtime = buildRuntime({
    commands: [
      {
        id: "save",
        ref: { kind: "command", id: "save" },
        title: "Save",
        async run(ctx) {
          await ctx.events.emit(changed, { value: "plain" });
          await ctx.events.emit(changed, { value: "claimed", projectId: "foreign", workspaceId: "foreign-workspace" });
        },
      },
    ],
    hooks: [
      {
        id: "project",
        ref: { kind: "hook", id: "project" },
        event: changed,
        async run(ctx, payload) {
          payloads.push(payload);
          contexts.push({ projectId: ctx.projectId, workspaceId: ctx.workspaceId });
          const record = await ctx.storage.records.read(ctx.storage.records.id("projection"));
          await ctx.storage.records.commit({
            operationId: crypto.randomUUID(),
            edits: [{ recordId: record.recordId, expectedRevision: record.revision, replace: payload.value }],
          });
          await ctx.events.emit(projected, { value: payload.value });
        },
      },
      {
        id: "nested",
        ref: { kind: "hook", id: "nested" },
        event: projected,
        async run(ctx, payload) {
          contexts.push({ projectId: ctx.projectId, workspaceId: ctx.workspaceId });
          await ctx.storage.set("nested", payload.value);
        },
      },
    ],
  });
  const runner = createCommandRunner(runtime, {
    buildEnvironment: (input) => {
      const storage = stores.get(input.projectId) ?? createMemoryStorage();
      stores.set(input.projectId, storage);
      return stubEnvironment(storage, { workspaceId: input.workspaceId });
    },
  });
  expect(
    (await runner.execute({ commandId: "pstdio.lab.command.save", projectId: "local", workspaceId: "local-workspace" }))
      .ok,
  ).toBe(true);
  expect(contexts).toEqual([
    { projectId: "local", workspaceId: "local-workspace" },
    { projectId: "local", workspaceId: "local-workspace" },
    { projectId: "local", workspaceId: "local-workspace" },
    { projectId: "local", workspaceId: "local-workspace" },
  ]);
  expect(payloads).toEqual([
    { value: "plain" },
    { value: "claimed", projectId: "foreign", workspaceId: "foreign-workspace" },
  ]);
  expect([...stores.keys()]).toEqual(["local"]);
  expect(await stores.get("local")!.get<string>("projection")).toBe("claimed");
  expect(await stores.get("local")!.get<string>("nested")).toBe("claimed");
});
