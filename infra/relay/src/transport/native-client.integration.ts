import { afterAll, beforeAll, expect, test } from "bun:test";
import { createRecordStorage, type GroupedState, type StorageOwner } from "pstdio-sync";
import { createRelayAdapter } from "pstdio-sync/relay";
import { startRelay } from "../service";
import { createTransportFixture } from "./integration-fixture";

const fixture = createTransportFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

const local = (owner: StorageOwner, environmentId: string) => {
  let state: GroupedState = { owner, accepted: null, journal: [] };
  let tail = Promise.resolve();
  return createRecordStorage({
    owner,
    environmentId,
    store: {
      transaction: <T>(_owner: StorageOwner, action: (state: GroupedState) => Promise<T>) => {
        const result = tail.then(async () => {
          const draft = structuredClone(state);
          const result = await action(draft);
          state = draft;
          return result;
        });
        tail = result.then(
          () => undefined,
          () => undefined,
        );
        return result;
      },
    },
  });
};

test("two journal owners synchronize through the native HTTP adapter and retain disconnected work", async () => {
  const context = await fixture.context();
  const server = startRelay({ hostname: "127.0.0.1", port: 0 }, context);
  const grant = await context.manager.register({
    requestId: "second-environment",
    accountId: context.scope.accountId,
    workbenchId: context.scope.workbenchId,
    environmentId: "native-second",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  const secondAccess = await context.issue(grant.token!);
  const controller = new AbortController();
  const adapter = (token: string) =>
    createRelayAdapter({
      origin: server.url.origin,
      scope: context.scope,
      token: async () => token,
      signal: controller.signal,
    });
  const first = local(context.scope, context.environmentId);
  const second = local(context.scope, "native-second");
  try {
    await first.records.commit({
      operationId: "online",
      edits: [{ recordId: "note", expectedRevision: (await first.records.read("note")).revision, replace: "online" }],
    });
    expect((await first.synchronize(adapter(context.token))).status).toBe("synchronized");
    await second.synchronize(adapter(secondAccess.token));
    expect((await second.records.read("note")).value).toBe("online");
    await second.records.commit({
      operationId: "offline",
      edits: [{ recordId: "note", expectedRevision: (await second.records.read("note")).revision, replace: "offline" }],
    });
    expect((await first.records.read("note")).value).toBe("online");
    expect((await second.readState()).pending).toHaveLength(1);
    await second.synchronize(adapter(secondAccess.token));
    await first.synchronize(adapter(context.token));
    expect((await first.records.read("note")).value).toBe("offline");
    expect((await second.readState()).pending).toHaveLength(0);
    for (const [storage, operationId] of [
      [first, "first-choice"],
      [second, "second-choice"],
    ] as const)
      await storage.records.commit({
        operationId,
        edits: [
          { recordId: "note", expectedRevision: (await storage.records.read("note")).revision, replace: operationId },
        ],
      });
    await first.synchronize(adapter(context.token));
    await second.synchronize(adapter(secondAccess.token));
    const conflict = (await second.records.conflicts())[0]!;
    expect(conflict.alternativeOperationIds).toContain("second-choice");
    const inspection = await second.records.inspect(conflict.conflictId);
    await second.records.resolve({
      operationId: "resolved-choice",
      conflictId: inspection.conflictId,
      capturedOperationIds: inspection.capturedOperationIds,
      expectedConflicts: inspection.expectedConflicts,
      expectedInputs: inspection.expectedInputs,
      choose: "local",
    });
    await second.synchronize(adapter(secondAccess.token));
    await first.synchronize(adapter(context.token));
    expect(await first.records.conflicts()).toEqual([]);
    expect((await first.records.read("note")).value).toBe("second-choice");
    expect((await second.records.read("note")).value).toBe("second-choice");
  } finally {
    controller.abort();
    await server.stop(true);
    await context.close();
  }
});
