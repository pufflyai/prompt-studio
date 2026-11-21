import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { createDb } from "../../db/connection.pglite";
import { automation_runs, automation_tokens } from "../../db/schemas.pg";
import { createProjectsDBService } from "../projects/projects";
import { createAutomationDBService } from "./automation";

let close: () => Promise<void>;
let db: DbClient;
let projectId: string;
let service: ReturnType<typeof createAutomationDBService>;
let principalId: string;
let tokenId: string;

beforeEach(async () => {
  const created = await createDb({ path: ":memory:" });
  close = created.close;
  db = created.db;
  projectId = (await createProjectsDBService(db).create({ name: "automation-retention" })).id;
  service = createAutomationDBService(db);
  tokenId = crypto.randomUUID();
  const token = await service.createToken({
    name: "retention-test",
    createdBy: "test",
    tokenId,
    tokenPrefix: `pst_at_${tokenId}`,
    tokenDigest: "test-digest",
    projectId,
    commandScopes: ["pstdio.test.command.run"],
    expiresAt: "2099-01-01T00:00:00.000Z",
  });
  principalId = token.principal.id;
});

afterEach(async () => {
  try {
    await close();
  } finally {
    // Hooks recreate these owners; release closed engines between cases and files.
    close = undefined!;
    db = undefined!;
    service = undefined!;
  }
});

const createRun = (idempotencyKey: string) =>
  service.createRun({
    projectId,
    principalId,
    tokenId,
    commandId: "pstdio.test.command.run",
    idempotencyKey,
    inputHash: idempotencyKey,
    inputJson: { commandId: "pstdio.test.command.run", input: {} },
  });

describe("automation run persistence", () => {
  test("extension activity selects the latest matching command inside its database limit", async () => {
    const owner = { projectId, extensionId: "example.worker" };
    const principal = await service.getOrCreateExtensionPrincipal(owner);
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const commandId = i === 3 ? "example.worker.command.other" : "example.worker.command.run";
      const result = await service.createRun({
        projectId,
        principalId: principal.id,
        tokenId: null,
        commandId,
        idempotencyKey: String(i),
        inputHash: String(i),
        inputJson: { commandId, input: {} },
      });
      await db
        .update(automation_runs)
        .set({ created_at: `2026-11-15T00:00:0${i}Z` })
        .where(eq(automation_runs.id, result.run.id));
      ids.push(result.run.id);
    }
    const page = await service.listExtensionRuns(owner, {
      commandId: "example.worker.command.run",
      limit: 1,
      order: "newest",
    } as never);
    expect(page.map(({ id }) => id)).toEqual([ids[2]]);
    expect(await service.listExtensionRuns({ ...owner, extensionId: "peer" }, { limit: 1 } as never)).toEqual([]);
  });
  test("preserves idempotency across token rotation for one principal", async () => {
    const first = await createRun("rotation-safe");
    const rotatedTokenId = crypto.randomUUID();
    const rotated = await service.createToken({
      name: "retention-test rotated",
      createdBy: "test",
      principalId,
      tokenId: rotatedTokenId,
      tokenPrefix: `pst_at_${rotatedTokenId}`,
      tokenDigest: "rotated-digest",
      projectId,
      commandScopes: ["pstdio.test.command.run"],
      expiresAt: "2099-01-01T00:00:00.000Z",
    });

    const retry = await service.createRun({
      projectId,
      principalId: rotated.principal.id,
      tokenId: rotated.token.id,
      commandId: "pstdio.test.command.run",
      idempotencyKey: "rotation-safe",
      inputHash: "rotation-safe",
      inputJson: { commandId: "pstdio.test.command.run", input: {} },
    });

    expect(rotated.principal.id).toBe(principalId);
    expect(retry.created).toBe(false);
    expect(retry.run.id).toBe(first.run.id);
  });

  test("rejects runs whose project, principal, and token do not share ownership", async () => {
    const peerTokenId = crypto.randomUUID();
    const peer = await service.createToken({
      name: "peer principal",
      createdBy: "test",
      tokenId: peerTokenId,
      tokenPrefix: `pst_at_${peerTokenId}`,
      tokenDigest: "peer-digest",
      projectId,
      commandScopes: ["pstdio.test.command.run"],
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    const foreignProjectId = (await createProjectsDBService(db).create({ name: "other-project" })).id;
    const foreignTokenId = crypto.randomUUID();
    const foreign = await service.createToken({
      name: "foreign principal",
      createdBy: "test",
      tokenId: foreignTokenId,
      tokenPrefix: `pst_at_${foreignTokenId}`,
      tokenDigest: "foreign-digest",
      projectId: foreignProjectId,
      commandScopes: ["pstdio.test.command.run"],
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    const input = {
      projectId,
      principalId,
      tokenId: peer.token.id,
      commandId: "pstdio.test.command.run",
      idempotencyKey: "mismatched-owner",
      inputHash: "mismatched-owner",
      inputJson: { commandId: "pstdio.test.command.run", input: {} },
    };

    await expect(service.createRun(input)).rejects.toThrow("ownership");
    await expect(
      service.createRun({
        ...input,
        principalId: foreign.principal.id,
        tokenId: foreign.token.id,
        idempotencyKey: "foreign-project",
      }),
    ).rejects.toThrow("ownership");
    expect(await db.select().from(automation_runs)).toEqual([]);
  });

  test("deletes project-scoped automation credentials with their project", async () => {
    await createProjectsDBService(db).hardDelete(projectId);

    expect(await service.getPrincipal(projectId, principalId)).toBeNull();
    expect(await db.select().from(automation_tokens)).toEqual([]);
  });

  test("lets only one worker claim a queued run", async () => {
    const queued = (await createRun("claimed-once")).run;

    const claims = await Promise.all([
      service.claimQueuedRun(queued.id),
      service.claimQueuedRun(queued.id),
      service.claimQueuedRun(queued.id),
    ]);

    expect(claims.filter(Boolean)).toHaveLength(1);
    expect((await service.getRunById(queued.id))?.status).toBe("running");
    expect((await service.listRunEvents(queued.id)).map((event) => event.type)).toEqual(["queued", "running"]);
  });

  test("reads each run step as an event after the given cursor", async () => {
    const queued = (await createRun("stepped")).run;
    await service.claimQueuedRun(queued.id);
    const error = { code: "boom", message: "Command failed.", retryable: false };
    await service.transitionRun(queued.id, { status: "failed", error });

    const events = await service.listRunEvents(queued.id);
    expect(events.map((event) => event.type)).toEqual(["queued", "running", "failed"]);
    expect(events.map((event) => event.cursor)).toEqual(events.map((event) => event.cursor).sort((a, b) => a - b));
    expect(new Set(events.map((event) => event.cursor)).size).toBe(3);
    expect(events.at(-1)?.payload_json).toEqual({ error });
    expect((await service.listRunEvents(queued.id, events[1]!.cursor)).map((event) => event.type)).toEqual(["failed"]);
  });

  test("returns a run's later steps to a reader holding a cursor from the former event table", async () => {
    const queued = (await createRun("upgraded-reader")).run;
    await service.transitionRun(queued.id, { status: "cancelled" });

    expect((await service.listRunEvents(queued.id, 4_127)).map((event) => event.type)).toEqual(["queued", "cancelled"]);
  });

  test("keeps each step's cursor above the previous one when the clock steps back", async () => {
    const run = (await createRun("clock-step")).run;
    await service.claimQueuedRun(run.id);
    await service.transitionRun(run.id, { status: "succeeded", result: { ok: true } });
    await db
      .update(automation_runs)
      .set({ started_at: "2026-11-16T10:00:00.000Z", finished_at: "2026-11-16T09:59:59.000Z" })
      .where(eq(automation_runs.id, run.id));

    const events = await service.listRunEvents(run.id);
    const running = events.find((event) => event.type === "running")!;
    expect(events.at(-1)!.cursor).toBeGreaterThan(running.cursor);
    expect((await service.listRunEvents(run.id, running.cursor)).map((event) => event.type)).toEqual(["succeeded"]);
  });

  test("bounds event payloads by UTF-8 bytes", async () => {
    const queued = (await createRun("bounded-event")).run;

    await service.transitionRun(queued.id, {
      status: "failed",
      error: { code: "large", message: "å".repeat(9_000), retryable: false },
    });

    const events = await service.listRunEvents(queued.id);
    expect(events.at(-1)?.payload_json).toEqual({ truncated: true });
  });

  test("prunes only terminal runs older than the retention boundary", async () => {
    const old = (await createRun("old")).run;
    await service.transitionRun(old.id, { status: "succeeded", result: { ok: true } });
    await db
      .update(automation_runs)
      .set({ finished_at: "2020-01-01T00:00:00.000Z" })
      .where(eq(automation_runs.id, old.id));

    const current = (await createRun("current")).run;
    await service.transitionRun(current.id, { status: "succeeded", result: { ok: true } });
    const queued = (await createRun("queued")).run;

    expect(await service.pruneTerminalRuns("2021-01-01T00:00:00.000Z")).toEqual([{ id: old.id }]);
    expect(await service.getRunById(old.id)).toBeNull();
    expect(await service.listRunEvents(old.id)).toEqual([]);
    expect(await service.getRunById(current.id)).not.toBeNull();
    expect(await service.getRunById(queued.id)).not.toBeNull();
  });
});

test("machine tokens retain inherited owner metadata and retried run identity", async () => {
  const { automation_tokens } = await import("../../db/schemas.pg");
  const [stored] = await db.select().from(automation_tokens).where(eq(automation_tokens.id, tokenId));
  expect(stored).toMatchObject({ name: "retention-test", created_by: "test" });
  const first = await createRun("inherited-owner");
  const second = await createRun("inherited-owner");
  expect(second.created).toBe(false);
  expect(second.run.id).toBe(first.run.id);
  expect((await service.getToken(tokenId))?.principal.id).toBe(principalId);
});

test("clearing extension user data retains automation ownership and historical run access", async () => {
  const {
    createExtensionInstancesDBService,
    createInstalledExtensionSourcesDBService,
    createExtensionUserDataDBService,
  } = await import("../../index");
  const { storeExtensionAutomationOwner } = await import("./automation-owners");
  const extensionId = "example.automation-owner";
  const source = await createInstalledExtensionSourcesDBService(db).register({
    install_name: "automation-owner",
    extension_id: extensionId,
    display_name: "Automation owner",
    source_kind: "local_path",
    source_path: "/automation-owner",
  });
  const instance = await createExtensionInstancesDBService(db).create({
    installed_extension_id: source.id,
    scope_type: "project",
    scope_id: projectId,
  });
  const originalId = "opaque-owner:with-colons";
  await storeExtensionAutomationOwner(db, {
    id: originalId,
    project_id: projectId,
    name: extensionId,
    created_by: "extension",
    created_at: new Date().toISOString(),
    disabled_at: null,
  });
  const queued = await service.createRun({
    projectId,
    principalId: originalId,
    tokenId: null,
    commandId: "example.automation-owner.command.run",
    idempotencyKey: "retained-history",
    inputHash: "history",
    inputJson: {},
  });
  await createExtensionUserDataDBService(db).deleteForInstance(instance.id);
  expect(await createExtensionUserDataDBService(db).hasUserData(instance.id)).toBe(false);
  expect((await service.getOrCreateExtensionPrincipal({ projectId, extensionId })).id).toBe(originalId);
  expect(await service.getExtensionRun({ projectId, extensionId }, queued.run.id)).toMatchObject({
    id: queued.run.id,
    principal_id: originalId,
  });
});
