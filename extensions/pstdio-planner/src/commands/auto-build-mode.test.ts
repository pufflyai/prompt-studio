import { expect, test } from "bun:test";
import type { StorageGroup } from "@pstdio/sdk/extensions";
import { type AutoBuildMode, autoBuildChanged, defaultAutoBuildIgnore } from "../data/auto-build-mode";
import { fixture } from "./auto-build.fixture";
import { configureAutoBuildCommand, readAutoBuildCommand } from "./auto-build-mode";

test("a new project defaults to ignoring Backlog and Done", async () => {
  const { ctx, storage } = await fixture();
  await storage.delete("auto-build");
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({
    enabled: false,
    prompt: "",
    ignore: await defaultAutoBuildIgnore(ctx),
  });
});

test("saves the prompt and ignore filter across stopping and restarting", async () => {
  const { ctx } = await fixture();
  const ignore = {
    conjunction: "and" as const,
    rules: [{ attributeId: "title", condition: "contains" as const, value: "Postpone" }],
  };
  const first = await configureAutoBuildCommand.run(ctx, { enabled: true, prompt: "Focus on the release.", ignore });
  await configureAutoBuildCommand.run(ctx, { enabled: false });
  const restarted = await configureAutoBuildCommand.run(ctx, { enabled: true });
  expect(restarted.revision).not.toBe(first.revision);
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({
    enabled: true,
    prompt: "Focus on the release.",
    ignore,
  });
});

test("starting requires a nonempty supervisor prompt", async () => {
  const { ctx, storage } = await fixture();
  await storage.delete("auto-build");
  await expect(configureAutoBuildCommand.run(ctx, { enabled: true, prompt: "  " })).rejects.toThrow("Enter a prompt");
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ enabled: false });
});

test("starting saves the mode and supervisor reset together before notifying observers", async () => {
  const { ctx, storage } = await fixture();
  await configureAutoBuildCommand.run(ctx, { enabled: false });
  await storage.set("auto-build-supervisor", { sessionId: "previous-supervisor" });
  const groups: StorageGroup[] = [];
  const commit = storage.records.commit;
  storage.records.commit = async (group) => {
    groups.push(group);
    return commit(group);
  };
  const observed: unknown[] = [];
  const observe = async () => {
    observed.push({
      mode: await storage.get("auto-build"),
      supervisor: await storage.get("auto-build-supervisor"),
    });
  };
  const emit = ctx.events.emit;
  ctx.events.emit = async (event, payload) => {
    if (event === autoBuildChanged) await observe();
    return emit(event, payload);
  };
  ctx.automation.enqueue = async () => {
    await observe();
    return {} as never;
  };
  const mode = await configureAutoBuildCommand.run(ctx, { enabled: true, prompt: "Start a fresh run" });
  expect(groups).toEqual([
    {
      operationId: expect.any(String),
      edits: [
        { recordId: storage.records.id("auto-build"), replace: { ...mode } },
        { recordId: storage.records.id("auto-build-supervisor"), replace: {} },
      ],
    },
  ]);
  expect(observed).toEqual([
    { mode, supervisor: {} },
    { mode, supervisor: {} },
  ]);
});

test("a failed start save preserves the old mode and supervisor without sending effects", async () => {
  const { ctx, storage } = await fixture();
  await configureAutoBuildCommand.run(ctx, { enabled: false });
  const previous = await storage.get<AutoBuildMode>("auto-build");
  await storage.set("auto-build-supervisor", { sessionId: "previous-supervisor" });
  storage.records.commit = async () => {
    throw new Error("Storage unavailable");
  };
  const effects: unknown[] = [];
  const emit = ctx.events.emit;
  ctx.events.emit = async (...args) => {
    effects.push(args);
    return emit(...args);
  };
  ctx.automation.enqueue = async (...args) => {
    effects.push(args);
    return {} as never;
  };
  await expect(configureAutoBuildCommand.run(ctx, { enabled: true, prompt: "New run" })).rejects.toThrow(
    "Storage unavailable",
  );
  expect(await storage.get<AutoBuildMode>("auto-build")).toEqual(previous);
  expect(await storage.get<{ sessionId: string }>("auto-build-supervisor")).toEqual({
    sessionId: "previous-supervisor",
  });
  expect(effects).toEqual([]);
});
