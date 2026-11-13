import { expect, test } from "bun:test";
import type { CommandInvocation, CommandRef, Struct } from "@pstdio/sdk/extensions";
import { createMemoryActivity, createMemoryStorage } from "@pstdio/sdk/testing";
import { ATTEMPTS_COLLECTION, putAttempt, readAttempt } from "../data/attempt-storage";
import type { AttemptRecord } from "../data/attempt-types";
import { withQueuedWriteGuard } from "../data/write-guard";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { migrateTicketOutcomesCommand } from "./migrate-ticket-outcomes";

test("migration re-reads queued attempts and preserves distinct outcomes when a report was reused", async () => {
  const base = createMemoryStorage();
  const activity = createMemoryActivity();
  const listed = Promise.withResolvers<void>();
  const storage = {
    ...base,
    collection<T>(name: string) {
      const collection = base.collection<T>(name);
      return name !== ATTEMPTS_COLLECTION
        ? collection
        : {
            ...collection,
            list: async () => {
              const rows = await collection.list();
              listed.resolve();
              return rows;
            },
          };
    },
  };
  const refs = new Set<string>();
  const createdAt = "2026-10-01T12:00:00.000Z";
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: {
      activity,
      commands: {
        execute: async <TParams extends Struct, TResult>(
          _command: CommandRef<TParams, TResult>,
          invocation: CommandInvocation<TParams>,
        ) => {
          const input = invocation.params as { entryId?: string };
          let value: unknown;
          if (input.entryId) {
            refs.add(input.entryId);
            value = {};
          } else value = { report: { id: "report", body: "Historical evidence", createdAt, files: [] }, files: [] };
          return { ok: true, status: "success", value: value as TResult };
        },
      },
    },
  });
  const ticket = await createTicketCommand.run(ctx, { title: "Migrate history" });
  const actor = { type: "agent" as const, id: "historical-agent", displayName: "Historical agent" };
  const first = {
    revision: 1,
    baseSha: "b".repeat(40),
    headSha: "a".repeat(40),
    changeRequestReportId: "report",
    submittedAt: createdAt,
    submittedBy: actor,
    reviews: [],
  };
  const attempt: AttemptRecord = {
    schemaVersion: 2,
    workspaceId: "workspace",
    workspaceShorthand: "WS-1",
    ticketId: ticket.id,
    ticketShorthand: ticket.shorthand,
    implementationSessionId: actor.id,
    base: { workspaceId: null, headSha: first.baseSha },
    revisions: [first],
    implementationDisconnectRetries: 0,
    reviewDisconnectRetries: 0,
    blocker: null,
    createdAt,
    updatedAt: createdAt,
  };
  await putAttempt(storage, attempt);
  const held = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const writing = withQueuedWriteGuard(ctx, "attempt:workspace", async () => {
    held.resolve();
    await release.promise;
    await putAttempt(storage, { ...attempt, revisions: [first, { ...first, revision: 2, headSha: "c".repeat(40) }] });
  });
  await held.promise;
  const migrating = migrateTicketOutcomesCommand.run(ctx, { id: ticket.id });
  await listed.promise;
  release.resolve();
  await writing;
  await migrating;
  const migrated = (await readAttempt(storage, "workspace"))!;
  expect(migrated.revisions).toHaveLength(2);
  const resource = { projectId: ctx.projectId, extensionId: ctx.extensionId, type: "ticket", id: ticket.id };
  const ids = migrated.revisions.map((revision) => revision.changeRequestActivityId!);
  expect(new Set(ids).size).toBe(2);
  expect((await activity.get(resource, ids[0]!)).revision?.headSha).toBe(first.headSha);
  expect((await activity.get(resource, ids[1]!)).revision?.headSha).toBe("c".repeat(40));
  await migrateTicketOutcomesCommand.run(ctx, { id: ticket.id });
  expect(
    (await readAttempt(storage, "workspace"))!.revisions.map((revision) => revision.changeRequestActivityId),
  ).toEqual(ids);
  expect(refs.size).toBe(2);
  const native = await activity.publish(resource, {
    key: "native-with-attempt",
    kind: "implementation",
    body: "New outcome",
    revision: { ...(await activity.get(resource, ids[0]!)).revision!, attemptId: "workspace" },
  });
  const current = (await readAttempt(storage, "workspace"))!;
  await putAttempt(storage, {
    ...current,
    revisions: current.revisions.map((revision, index) =>
      index === 0 ? { ...revision, changeRequestActivityId: native.id } : revision,
    ),
  });
  await migrateTicketOutcomesCommand.run(ctx, { id: ticket.id });
  expect((await readAttempt(storage, "workspace"))!.revisions[0]!.changeRequestActivityId).toBe(native.id);
});
