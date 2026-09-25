import { afterEach, beforeEach, expect, test } from "bun:test";
import { createAutomationDBService, createDb, createProjectsDBService } from "pstdio-db";
import type { ExtensionsRouteDeps } from "../extensions/deps";
import { EventBus } from "../sync/event-bus";
import { createAutomationService } from "./automation-service";

let database: Awaited<ReturnType<typeof createDb>>;
let db: ReturnType<typeof createAutomationDBService>;
let service: ReturnType<typeof createAutomationService>;
let projectId: string;
let started: Promise<void>;
let observedAbort: boolean;
let eventBus: EventBus;
const extensionId = "example.worker";
const commandId = "example.worker.command.run";

beforeEach(async () => {
  database = await createDb({ path: ":memory:" });
  db = createAutomationDBService(database.db);
  projectId = (await createProjectsDBService(database.db).create({ name: "automation" })).id;
  let signalStarted!: () => void;
  started = new Promise<void>((resolve) => {
    signalStarted = resolve;
  });
  observedAbort = false;
  eventBus = new EventBus();
  service = createAutomationService({
    automationDBService: db,
    getCommandDeps: () =>
      ({
        extensionRuntimeCatalog: {
          get: async () => ({
            runtime: {
              hooks: [],
              commands: [
                { id: commandId, extensionId, automation: true, params: {} },
                { id: "peer.command.run", extensionId: "peer", automation: true, params: {} },
                { id: "example.worker.command.private", extensionId, automation: false, params: {} },
              ],
            },
          }),
        },
        eventBus,
        repoService: { listByProject: async () => [] },
        activityEventsService: { create: async () => {} },
      }) as unknown as ExtensionsRouteDeps,
    executeCommand: async (_deps, input) => {
      expect(input.body.source).toBe("automation");
      signalStarted();
      await new Promise<void>((resolve) =>
        input.signal!.addEventListener(
          "abort",
          () => {
            observedAbort = true;
            resolve();
          },
          { once: true },
        ),
      );
      return { outcome: { ok: false, status: "error", reason: "aborted" } } as never;
    },
  });
});

afterEach(async () => {
  await service?.close();
  await database?.close();
});

const enqueue = (key = "run", input = {}) =>
  service.enqueueForExtension({ projectId, extensionId, commandId, input, key });

test("reuses extension principals and persists runs without machine tokens", async () => {
  const owners = await Promise.all([1, 2].map(() => db.getOrCreateExtensionPrincipal({ projectId, extensionId })));
  expect(owners[0].id).toBe(owners[1].id);
  const run = await enqueue();
  const stored = await db.getRun(projectId, run.id);
  expect(stored?.principal_id).toBe(owners[0].id);
  expect(stored?.token_id).toBeNull();
  await started;
});

test("reuses an idempotency key and rejects changed input", async () => {
  const first = await enqueue();
  expect((await enqueue()).id).toBe(first.id);
  await expect(enqueue("run", { metadata: { different: true } })).rejects.toMatchObject({
    code: "idempotency_conflict",
  });
  await started;
});

test("scopes reads and cancellation to the extension and project", async () => {
  const run = await enqueue();
  await started;
  expect((await service.listForExtension({ projectId, extensionId })).map((entry) => entry.id)).toEqual([run.id]);
  expect(await service.listForExtension({ projectId, extensionId: "peer" })).toEqual([]);
  expect(await service.getForExtension({ projectId, extensionId: "peer" }, run.id)).toBeUndefined();
  await expect(service.cancelForExtension({ projectId, extensionId: "peer" }, run.id)).rejects.toMatchObject({
    status: 404,
  });
  const otherProject = (await createProjectsDBService(database.db).create({ name: "other" })).id;
  expect(await service.getForExtension({ projectId: otherProject, extensionId }, run.id)).toBeUndefined();
  expect(await service.listForExtension({ projectId, extensionId }, { status: ["failed"] })).toEqual([]);
  const cancelled = await service.cancelForExtension({ projectId, extensionId }, run.id);
  expect(observedAbort).toBe(true);
  expect(cancelled.status).toBe("cancelled");
});

test("rejects another extension's command and commands without automation enabled", async () => {
  for (const target of ["peer.command.run", "example.worker.command.private"]) {
    await expect(
      service.enqueueForExtension({ projectId, extensionId, commandId: target, input: {}, key: "denied" }),
    ).rejects.toMatchObject({ status: 403 });
  }
});

test("validates the same strict input and key limits as machine runs", async () => {
  await expect(enqueue("")).rejects.toMatchObject({ code: "invalid_idempotency_key" });
  await expect(enqueue("x".repeat(201))).rejects.toMatchObject({ code: "invalid_idempotency_key" });
  await expect(enqueue("extra", { projectId: "foreign" })).rejects.toMatchObject({ code: "invalid_automation_input" });
  await expect(enqueue("large", { metadata: { text: "x".repeat(65536) } })).rejects.toMatchObject({
    code: "invalid_automation_input",
  });
});

test("delivers extension status events to view refresh subscribers", async () => {
  const run = await enqueue();
  await started;
  await service.cancelForExtension({ projectId, extensionId }, run.id);
  await Bun.sleep(0);
  const events = eventBus.getSince(0).filter((event) => event.table === "extension_events");
  expect(events).toHaveLength(3);
  for (const event of events) {
    expect(event.data).toMatchObject({ projectId, eventId: `${extensionId}.event.automation-run-changed` });
  }
});

test("recovers interrupted extension runs as retryable failures and publishes the change", async () => {
  const principal = await db.getOrCreateExtensionPrincipal({ projectId, extensionId });
  const stored = await db.createRun({
    projectId,
    principalId: principal.id,
    tokenId: null,
    commandId,
    idempotencyKey: "interrupted",
    inputHash: "hash",
    inputJson: { commandId, input: {} },
  });
  await db.claimQueuedRun(stored.run.id);
  await service.recoverInterruptedRuns();
  const recovered = await service.getForExtension({ projectId, extensionId }, stored.run.id);
  expect(recovered).toMatchObject({ status: "failed", error: { code: "host_restarted", retryable: true } });
  await Bun.sleep(0);
  expect(eventBus.getSince(0)).toHaveLength(1);
});

test("cancelling a terminal run does not emit another status transition", async () => {
  const run = await enqueue();
  await started;
  await service.cancelForExtension({ projectId, extensionId }, run.id);
  await Bun.sleep(0);
  const cursor = eventBus.seq;
  await service.cancelForExtension({ projectId, extensionId }, run.id);
  await Bun.sleep(0);
  expect(eventBus.getSince(cursor)).toEqual([]);
});
