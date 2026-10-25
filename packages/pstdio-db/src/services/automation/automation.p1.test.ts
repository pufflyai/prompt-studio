import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { createDb } from "../../db/connection.pglite";
import { automation_principals, automation_runs } from "../../db/schemas.pg";
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
  await close();
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

  test("deletes project-scoped principals with their project", async () => {
    await createProjectsDBService(db).hardDelete(projectId);

    expect(await db.select().from(automation_principals)).toEqual([]);
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

  test("rolls back a status transition when its matching event cannot be stored", async () => {
    const queued = (await createRun("atomic-terminal-event")).run;
    await db.execute(
      sql`alter table automation_run_events add constraint reject_succeeded_event check (type <> 'succeeded')`,
    );

    await expect(service.transitionRun(queued.id, { status: "succeeded", result: { ok: true } })).rejects.toThrow();

    expect((await service.getRunById(queued.id))?.status).toBe("queued");
    expect((await service.listRunEvents(queued.id)).map((event) => event.type)).toEqual(["queued"]);
  });

  test("bounds stored event payloads by UTF-8 bytes", async () => {
    const queued = (await createRun("bounded-event")).run;

    await service.appendEvent(queued.id, "diagnostic", { detail: "å".repeat(9_000) });

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
