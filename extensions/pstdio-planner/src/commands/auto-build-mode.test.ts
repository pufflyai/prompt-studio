import { expect, test } from "bun:test";
import { defaultAutoBuildIgnore } from "../data/auto-build-mode";
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

test("concurrent mode saves retain both callers and return the platform conflict without replaying effects", async () => {
  const { ctx, storage } = await fixture();
  const results = await Promise.all([
    configureAutoBuildCommand.run(ctx, { enabled: false, prompt: "First caller" }),
    configureAutoBuildCommand.run(ctx, { enabled: false, prompt: "Second caller" }),
  ]);
  expect(results.map(({ storageOutcome }) => storageOutcome.status).sort()).toEqual(["conflict", "saved-locally"]);
  const retained = results.find(({ storageOutcome }) => storageOutcome.status === "conflict")!;
  if (retained.storageOutcome.status !== "conflict") throw new Error("Expected retained mode");
  const inspected = await storage.records.inspect(retained.storageOutcome.conflictId);
  expect(inspected.alternatives[0].records[0].value).toMatchObject({ prompt: "Second caller", enabled: false });
  expect(await storage.get("auto-build")).toMatchObject({ prompt: "First caller", enabled: false });
  expect(
    (
      await storage.records.resolve({
        operationId: crypto.randomUUID(),
        conflictId: inspected.conflictId,
        expectedConflicts: inspected.expectedConflicts,
        capturedOperationIds: inspected.capturedOperationIds,
        expectedInputs: inspected.expectedInputs,
        choose: "local",
      })
    ).status,
  ).toBe("saved-locally");
  expect(await storage.get("auto-build")).toMatchObject({ prompt: "Second caller", enabled: false });
});

test("a competing supervisor save retains the whole start proposal without waking or emitting a change", async () => {
  const { ctx, storage } = await fixture();
  await configureAutoBuildCommand.run(ctx, { enabled: false });
  await storage.set("auto-build-supervisor", { sessionId: "previous-supervisor" });
  const events: unknown[] = [];
  const wakes: unknown[] = [];
  const emit = ctx.events.emit;
  ctx.events.emit = async (...args) => {
    events.push(args);
    return emit(...args);
  };
  ctx.automation.enqueue = async (input) => {
    wakes.push(input);
    return {} as never;
  };
  const supervisorId = storage.records.id("auto-build-supervisor");
  const read = storage.records.read;
  storage.records.read = async (...args) => {
    const observed = await read(...args);
    if (args[0] === supervisorId) {
      storage.records.read = read;
      await storage.set("auto-build-supervisor", { sessionId: "concurrent-supervisor" });
    }
    return observed;
  };
  const result = await configureAutoBuildCommand.run(ctx, { enabled: true, prompt: "Start a fresh run" });
  expect(result.storageOutcome.status).toBe("conflict");
  expect(await storage.get("auto-build")).toMatchObject({ enabled: false });
  expect(await storage.get<{ sessionId: string }>("auto-build-supervisor")).toEqual({
    sessionId: "concurrent-supervisor",
  });
  expect(events).toEqual([]);
  expect(wakes).toEqual([]);
  if (result.storageOutcome.status !== "conflict") throw new Error("Expected retained start proposal");
  const inspected = await storage.records.inspect(result.storageOutcome.conflictId);
  expect(inspected.alternatives[0].records).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        recordId: storage.records.id("auto-build"),
        value: expect.objectContaining({ enabled: true, prompt: "Start a fresh run" }),
      }),
      expect.objectContaining({ recordId: supervisorId, value: {} }),
    ]),
  );
});
