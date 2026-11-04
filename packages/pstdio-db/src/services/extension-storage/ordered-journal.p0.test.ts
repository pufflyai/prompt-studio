import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type OrderedAdmission, type OrderedDecision, prepareOrderedOperation } from "pstdio-sync/records";
import { fingerprint, type Json } from "pstdio-sync-contracts";
import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { withOrderedOwner } from "./ordered-journal";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
const fixture = async (path = ":memory:", projectId = crypto.randomUUID()) => {
  const connection = await createDb({ path });
  cleanup.push(connection.close);
  const now = new Date().toISOString();
  await connection.db
    .insert(projects)
    .values({ id: projectId, name: "Board", shorthand: "B", created_at: now, updated_at: now })
    .onConflictDoNothing();
  const owner = { workbenchId: projectId, extensionId: "example.board" };
  const run = <T>(action: Parameters<typeof withOrderedOwner<T>>[2]) => withOrderedOwner(connection.db, owner, action);
  return { ...connection, owner, run };
};
const operation = () =>
  prepareOrderedOperation(
    {
      operationId: "careful",
      edits: [
        { recordId: "setting", replace: { model: "small" } },
        { recordId: "audit", replace: "side effect" },
      ],
    },
    new Map(),
  );
const decision = (fingerprint: string, epoch = "first"): OrderedDecision => ({
  operationId: "careful",
  fingerprint,
  epoch,
  state: "refused",
});

test("a pre-open save survives restart and delivery acknowledgement retains its immutable envelope", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ordered-journal-"));
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  const first = await fixture(directory);
  const input = await operation();
  const request = await fingerprint({ request: "original" });
  await first.run((journal) => journal.queue(input, request));
  await first.close();
  cleanup.pop();
  const reopened = await fixture(directory, first.owner.workbenchId);
  const admission = { epoch: "first", operation: input, dependencies: [] };
  await reopened.run(async (journal) => {
    expect(await journal.pending()).toMatchObject([{ operation: input, requestFingerprint: request, admission: null }]);
    expect(await journal.pendingFor(["unrelated"])).toEqual([]);
    expect(await journal.pendingFor(["audit"])).toHaveLength(1);
    await journal.admit(admission);
    await journal.delivered([input.operationId], "first");
    expect(await journal.pending()).toMatchObject([{ operation: input, delivered: true, admission }]);
    expect(await journal.outcome(input.operationId)).toBeUndefined();
  });
});

test("admission captures its dependency wrapper before asynchronous verification", async () => {
  const f = await fixture();
  const input = await operation();
  await f.run(async (journal) => {
    await journal.queue(input, input.fingerprint);
    const admission: OrderedAdmission = { epoch: "first", operation: input, dependencies: [] };
    const expected = structuredClone(admission);
    const saving = journal.admit(admission);
    admission.dependencies.push({ operationId: "late", fingerprint: input.fingerprint, epoch: "first" });
    await saving;
    expect((await journal.localOperation(input.operationId))?.admission).toEqual(expected);
  });
});

test("only the exact admitted decision settles a save; a late old receipt cannot replace the new order", async () => {
  const f = await fixture();
  const input = await operation();
  const request = await fingerprint({ request: "original" });
  await f.run(async (journal) => {
    await journal.queue(input, request);
    const admission = { epoch: "new", operation: input, dependencies: [] };
    await journal.admit(admission);
    await journal.recordDecision(decision(input.fingerprint, "old"), "old-wrapper");
    expect(await journal.pending()).toHaveLength(1);
    expect(await journal.outcome(input.operationId)).toBeUndefined();
    const exact = decision(input.fingerprint, "new");
    await journal.recordDecision(exact, await fingerprint(admission as unknown as Json));
    expect(await journal.pending()).toEqual([]);
    expect(await journal.pendingFor(["setting", "audit"])).toEqual([]);
    expect(await journal.outcome(input.operationId)).toEqual(exact);
    expect((await journal.localOperation(input.operationId))?.operation).toEqual(input);
    expect(await journal.cachedDecision(input.operationId, "old")).toEqual(decision(input.fingerprint, "old"));
  });
});

test("canonical JSON survives PostgreSQL with literal keys, NUL, Unicode and lone surrogates", async () => {
  const f = await fixture();
  const value = JSON.parse('{"__proto__":{"safe":true},"a/b":"\\u0000😀\\ud800","":"empty"}');
  const record = {
    recordId: "card",
    value,
    deleted: false,
    lifetime: "initial",
    stamps: { "/a~1b": '["canonical","epoch","seed"]' },
  };
  await f.run((journal) => journal.saveCanonical([record]));
  await f.run(async (journal) => {
    expect(await journal.canonical(["missing", "card"])).toEqual(new Map([["card", record]]));
    expect(Object.getPrototypeOf((await journal.canonical(["card"])).get("card")!.value)).toBe(Object.prototype);
  });
});

test("operation identity, admission and decisions remain immutable and a failed group transaction rolls back", async () => {
  const f = await fixture();
  const input = await operation();
  const request = await fingerprint({ request: "original" });
  await f.run(async (journal) => {
    await journal.queue(input, request);
    await journal.queue(input, request);
    expect(await journal.pending()).toHaveLength(1);
  });
  const changed = await prepareOrderedOperation(
    { operationId: "careful", edits: [{ recordId: "setting", replace: "different" }] },
    new Map(),
  );
  await expect(f.run((journal) => journal.queue(changed, request))).rejects.toThrow("identity");
  const admission = { epoch: "first", operation: input, dependencies: [] };
  await expect(
    f.run((journal) => journal.admit({ ...admission, operation: { ...input, edits: changed.edits } })),
  ).rejects.toThrow("identity");
  await f.run((journal) => journal.admit(admission));
  await expect(
    f.run((journal) =>
      journal.admit({
        ...admission,
        dependencies: [{ operationId: "parent", fingerprint: input.fingerprint, epoch: "first" }],
      }),
    ),
  ).rejects.toThrow("admission");
  await expect(
    f.run(async (journal) => {
      await journal.saveCanonical([
        { recordId: "setting", value: "partial", deleted: false, lifetime: "initial", stamps: {} },
      ]);
      await journal.recordDecision({ ...decision(input.fingerprint), fingerprint: changed.fingerprint }, "bad-wrapper");
    }),
  ).rejects.toThrow("identity");
  await f.run(async (journal) => {
    expect(await journal.canonical(["setting"])).toEqual(new Map());
    expect(await journal.pending()).toHaveLength(1);
  });
});

test("pending pages seek through hot-record groups without duplicates or loading the whole backlog", async () => {
  const f = await fixture();
  await f.run(async (journal) => {
    for (let index = 0; index < 25; index++) {
      const input = await prepareOrderedOperation(
        {
          operationId: `save-${index}`,
          edits: [
            { recordId: "hot", replace: index },
            { recordId: "also-hot", replace: index },
          ],
        },
        new Map(),
      );
      await journal.queue(input, input.fingerprint);
    }
  });
  await f.run(async (journal) => {
    const seen: string[] = [];
    let after = 0;
    for (const count of [10, 10, 5]) {
      const page = await journal.pendingFor(["hot", "also-hot"], { after, limit: 10 });
      expect(page).toHaveLength(count);
      seen.push(...page.map((row) => row.operation.operationId));
      after = page.at(-1)!.sequence;
    }
    expect(await journal.pendingFor(["hot"], { after, limit: 10 })).toEqual([]);
    expect(seen).toEqual(Array.from({ length: 25 }, (_, index) => `save-${index}`));
  });
});

test("a pending page preserves save order when its earliest group matches a later record batch", async () => {
  const f = await fixture();
  await f.run(async (journal) => {
    for (const [operationId, recordId] of [
      ["first", "last-batch"],
      ["second", "first-batch"],
      ["third", "middle"],
    ]) {
      const input = await prepareOrderedOperation(
        { operationId: operationId!, edits: [{ recordId: recordId!, replace: true }] },
        new Map(),
      );
      await journal.queue(input, input.fingerprint);
    }
  });
  const ids = Array.from({ length: 1001 }, (_, index) => `missing-${index}`);
  ids[0] = "first-batch";
  ids[500] = "middle";
  ids[1000] = "last-batch";
  await f.run(async (journal) => {
    const first = await journal.pendingFor(ids, { limit: 2 });
    expect(first.map((row) => row.operation.operationId)).toEqual(["first", "second"]);
    const next = await journal.pendingFor(ids, { after: first.at(-1)!.sequence, limit: 2 });
    expect(next.map((row) => row.operation.operationId)).toEqual(["third"]);
  });
});
