import { expect, test } from "bun:test";
import type { StorageGroup } from "@pstdio/sdk/extensions";
import { putAttempt } from "../data/attempt-storage";
import { type AutoBuildMode, autoBuildChanged } from "../data/auto-build-mode";
import { putTicket, ticketsCollection } from "../data/ticket-context.fixture";

import { fixture } from "./auto-build.fixture";
import { configureAutoBuildCommand, readAutoBuildCommand } from "./auto-build-mode";
import { autoBuildScopeCommand } from "./auto-build-scope";
import { runAttemptCommand } from "./run-attempt";
import { sessionRecord } from "./session-record.fixture";

const scope = async (ctx: Awaited<ReturnType<typeof fixture>>["ctx"]) => {
  const { revision } = await readAutoBuildCommand.run(ctx, {});
  await autoBuildScopeCommand.run(ctx, { revision, queries: [{}] });
};

test("a new project starts stopped with empty ticket filters", async () => {
  const { ctx, storage } = await fixture();
  await storage.delete("auto-build");
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({
    enabled: false,
    prompt: "",
    eligible: { conjunction: "and", rules: [] },
  });
});

test("saves the prompt and eligible filter across stopping and restarting", async () => {
  const { ctx, ticket } = await fixture();
  await ticket("Configure statuses");
  const eligible = {
    conjunction: "and" as const,
    rules: [{ attributeId: "title", condition: "does-not-contain" as const, value: "Postpone" }],
  };
  const first = await configureAutoBuildCommand.run(ctx, {
    enabled: true,
    prompt: "Focus on the release.",
    eligible,
  });
  await configureAutoBuildCommand.run(ctx, { enabled: false });
  const restarted = await configureAutoBuildCommand.run(ctx, { enabled: true });
  expect(restarted.revision).not.toBe(first.revision);
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({
    enabled: true,
    prompt: "Focus on the release.",
    eligible,
  });
});

test("starting requires a nonempty supervisor prompt", async () => {
  const { ctx, storage } = await fixture();
  await storage.delete("auto-build");
  await expect(configureAutoBuildCommand.run(ctx, { enabled: true, prompt: "  " })).rejects.toThrow("Enter a prompt");
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ enabled: false });
});

test("starting rejects incomplete eligible filters and leaves the run stopped", async () => {
  const { ctx, storage } = await fixture();
  await storage.delete("auto-build");
  await expect(
    configureAutoBuildCommand.run(ctx, {
      enabled: true,
      prompt: "Build it",
      eligible: { conjunction: "and", rules: [{ attributeId: "title", condition: "contains", value: "" }] },
    }),
  ).rejects.toThrow("eligible");
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ enabled: false });
});

test("Auto Build reports when eligible filters match no unfinished tickets", async () => {
  const { ctx, ticket } = await fixture();
  await ticket("Build the greeting");
  await configureAutoBuildCommand.run(ctx, {
    enabled: true,
    eligible: { conjunction: "and", rules: [{ attributeId: "title", condition: "contains", value: "unmatched" }] },
  });
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ matchingTicketCount: 0, completed: false });
  await configureAutoBuildCommand.run(ctx, { enabled: true, eligible: { conjunction: "and", rules: [] } });
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ matchingTicketCount: 1, completed: false });
});

test("an idle start reports tickets that already have work instead of a pending supervisor launch", async () => {
  const { ctx, ticket, storage } = await fixture();
  const task = await ticket("Build the greeting");
  const started = await runAttemptCommand.run(ctx, { ticket: task.id });
  await putAttempt(storage, {
    ...started.variant,
    revisions: [
      {
        revision: 1,
        baseSha: "main-sha",
        headSha: "main-sha",
        changeRequestReportId: "report",
        submittedAt: new Date().toISOString(),
        submittedBy: { type: "agent", id: "owner", displayName: "Owner" },
        reviews: [],
      },
    ],
  });
  ctx.sessions.get = async (id) =>
    id === "fixture-supervisor"
      ? null
      : sessionRecord({ id: started.variant.implementationSessionId, title: "Implementation", status: "completed" });
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({
    enabled: true,
    running: false,
    supervisor: null,
    matchingTicketCount: 1,
    readyTicketCount: 0,
    waitingTickets: [expect.objectContaining({ ticket: task.shorthand, reason: "existing-attempt" })],
  });
  await ticket("Fresh work");
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({
    readyTicketCount: 1,
    waitingTickets: [expect.objectContaining({ ticket: task.shorthand, reason: "existing-attempt" })],
  });
});

test("Auto Build succeeds when its scoped tickets are completed", async () => {
  const { ctx, ticket, storage } = await fixture();
  const first = await ticket("Calculator addition");
  const second = await ticket("Calculator subtraction");
  await scope(ctx);
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ completed: false });
  await putTicket(storage, { ...first, statusId: "done" });
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ completed: false });
  await putTicket(storage, { ...second, statusId: "done" });
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ completed: true, stuck: false });
  await putTicket(storage, { ...second, statusId: "ready" });
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ completed: false });
});

test("started work that leaves the eligible status keeps Auto Build unfinished", async () => {
  const { ctx, ticket, storage } = await fixture();
  const started = await ticket("Calculator addition");
  const finished = await ticket("Calculator subtraction");
  await configureAutoBuildCommand.run(ctx, {
    enabled: true,
    eligible: { conjunction: "and", rules: [{ attributeId: "status", condition: "is-any-of", value: ["ready"] }] },
  });
  await scope(ctx);
  await runAttemptCommand.run(ctx, { ticket: started.id });
  await putTicket(storage, {
    ...(await ticketsCollection(storage).get(started.id))!,
    statusId: "in-progress",
  });
  await putTicket(storage, { ...finished, statusId: "done" });
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ completed: false });
});

test("Auto Build does not report success before its scope is saved or after stopping", async () => {
  const { ctx, ticket, storage } = await fixture();
  const selected = await ticket("Calculator addition");
  await putTicket(storage, { ...selected, statusId: "done" });
  await configureAutoBuildCommand.run(ctx, { enabled: false });
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ completed: false });
  await configureAutoBuildCommand.run(ctx, { enabled: true });
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ completed: false });
  await scope(ctx);
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ completed: true });
});

test("completed ticket work clears an old supervisor automation error", async () => {
  const { ctx, ticket, storage } = await fixture();
  const selected = await ticket("Calculator addition");
  ctx.automation.list = async () =>
    [
      {
        commandId: `${ctx.extensionId}.command.auto-build`,
        createdAt: "2026-10-13T00:00:00Z",
        status: "failed",
        error: { message: "Supervisor failed earlier" },
      },
    ] as never;
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({
    completed: false,
    error: "Supervisor failed earlier",
  });
  await scope(ctx);
  await putTicket(storage, { ...selected, statusId: "done" });
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ completed: true, error: undefined });
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
        {
          recordId: storage.records.id("auto-build"),
          replace: expect.objectContaining({
            revision: mode.revision,
            state: "running",
            prompt: "Start a fresh run",
            eligible: mode.eligible,
          }),
        },
        { recordId: storage.records.id("auto-build-supervisor"), replace: {} },
      ],
    },
  ]);
  const { enabled: _enabled, ...stored } = mode;
  expect(observed).toEqual([
    { mode: JSON.parse(JSON.stringify(stored)), supervisor: {} },
    { mode: JSON.parse(JSON.stringify(stored)), supervisor: {} },
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
