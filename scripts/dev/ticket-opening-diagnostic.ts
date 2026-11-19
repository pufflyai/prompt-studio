import { join } from "node:path";
import type { StorageRecordIndex } from "pstdio-api-contracts/extension-kernel";

const workspace = process.argv[4];
const source = process.argv[2];
const label = process.argv[3];
if (!source || !label || !workspace)
  throw Error("Usage: bun scripts/dev/ticket-opening-diagnostic.ts <planner-source-root> <label> <host-source-root>");
if (process.env.PSTDIO_TICKET_BENCH_CHILD !== "1") {
  const child = Bun.spawn([process.execPath, import.meta.filename, source, label, workspace], {
    env: { ...process.env, PSTDIO_TICKET_BENCH_CHILD: "1" },
    stdout: "inherit",
    stderr: "inherit",
  });
  const deadline = setTimeout(() => {
    console.error("Benchmark exceeded its 60-second case cap");
    child.kill("SIGKILL");
  }, 60000);
  const code = await child.exited;
  clearTimeout(deadline);
  process.exit(code);
}
const { createExtensionStorageFixture } = await import(
  join(workspace, "packages/pstdio-db/src/services/extension-storage/extension-storage.fixture.ts")
);
const { storageRecordId } = await import(join(workspace, "packages/pstdio-sync/src/records/namespaces.ts"));
const { createMemoryStorage, makeCommandContext } = await import(join(workspace, "packages/sdk/dist/testing/index.js"));
const { sql } = await import(Bun.resolveSync("drizzle-orm", join(workspace, "packages/pstdio-db")));
const { resolveCollectionIndexes } = await import(
  join(workspace, "packages/pstdio-api-contracts/src/storage-indexes.ts")
);
const { readTicketTreeData } = await import(
  join(source, "extensions/pstdio-planner/src/commands/ticket-files-tree-data.ts")
);
const { getTicketContent } = await import(join(source, "extensions/pstdio-planner/src/commands/get-ticket-content.ts"));
const fixture = await createExtensionStorageFixture();
const scope = { extension_instance_id: fixture.instanceAId, scope_type: "project", scope_id: fixture.projectAId };
const native = await fixture.svc.open({ owner: { workbenchId: fixture.projectAId, extensionId: "ext.example" } });
const rows = Array.from({ length: 5000 }, (_, i) => ({
  id: `ticket-${i}`,
  title: `Ticket ${i}`,
  content: `${i}:${"Ticket body. ".repeat(650)}`,
  parentId: i === 1 ? "ticket-0" : null,
  dependsOn: i === 0 ? ["ticket-2"] : [],
  statusId: "backlog",
  archived: false,
  createdAt: "2026-11-14",
  updatedAt: "2026-11-14",
}));
const requests = Array.from({ length: 5000 }, (_, i) => ({
  id: `request-${i}`,
  ticketId: `ticket-${i}`,
  title: `Review ${i}`,
  instructions: "Review this work",
  request: { kind: "task" },
  requestedAt: "2026-11-14T00:00:00Z",
  requestedBy: { type: "agent", id: "agent", displayName: "Agent" },
  context: { reason: null, workspaceId: null, attemptRevision: null, sessionId: null, relatedSessionId: null },
}));
const all = [
  ...rows.map((value) => ({ name: "tickets", value })),
  ...requests.map((value) => ({ name: "planner-review-requests", value })),
  ...requests.map(({ id }) => ({
    name: "planner-review-request-outcomes",
    value: {
      id,
      requestId: id,
      kind: "answered",
      at: "2026-11-14T00:00:00Z",
      by: { type: "human", id: "person", displayName: "Person" },
      response: { confirmed: true },
    },
  })),
];
const preparation = performance.now();
try {
  for (let offset = 0; offset < all.length; offset += 100) {
    await native.records.commit({
      operationId: `seed-${offset}`,
      edits: all.slice(offset, offset + 100).map(({ name, value }) => ({
        recordId: storageRecordId(["project", fixture.projectAId, "collection", name], value.id),
        replace: { value, sortOrder: null },
      })),
    });
  }
  const memory = createMemoryStorage();
  let counts: Record<string, number> = {};
  const counted = (name: string, values: unknown[]) => {
    counts[name] = (counts[name] ?? 0) + values.length;
    return values;
  };
  const nativeRecords = native.scopedRecords("project", fixture.projectAId);
  const storage = {
    ...memory,
    records: {
      ...nativeRecords,
      defineIndexes: async (indexes: StorageRecordIndex[]) =>
        nativeRecords.defineIndexes(resolveCollectionIndexes(indexes, "project", fixture.projectAId)),
      readMany: async (ids: string[]) => {
        const values = await nativeRecords.readMany(ids);
        for (const value of values)
          if (value.exists && !value.deleted) counted((JSON.parse(value.recordId) as string[])[3], [value]);
        return values;
      },
    },
    collection: (name: string) => ({
      ...memory.collection(name),
      get: async (id: string) => {
        const value = await fixture.svc.getCollectionItem({ ...scope, collection: name }, id);
        counted(name, value ? [value] : []);
        return value?.value_json;
      },
      list: async () => {
        const values = await fixture.svc.listCollection({ ...scope, collection: name });
        counted(name, values);
        return values.map((item: { value_json: unknown }) => item.value_json);
      },
    }),
  };
  const ctx = makeCommandContext({
    storage,
    params: {},
    projectId: fixture.projectAId,
    overrides: {
      resources: {
        identity: async ({ id }: { id: string }) => ({ id, kind: "ticket", shorthand: `T-${id}`, aliases: [] }),
        identityMany: async ({ ids }: { ids: string[] }) =>
          ids.map((id) => ({ id, kind: "ticket", shorthand: `T-${id}`, aliases: [] })),
      },
      workspaces: { list: async () => [], listProviders: async () => [] },
      sessions: { query: async () => ({ items: [], nextCursor: null }) },
    },
  });
  let indexInstallationMs = 0;
  const fullDeclaration = join(source, "extensions/pstdio-planner/src/data/storage-indexes.ts");
  const declaration = join(source, "extensions/pstdio-planner/src/data/navigation-queries.ts");
  if (await Bun.file(declaration).exists()) {
    const indexes = (await Bun.file(fullDeclaration).exists())
      ? (await import(fullDeclaration)).plannerStorageIndexes()
      : (await import(declaration)).plannerNavigationIndexes;
    const start = performance.now();
    await storage.records.defineIndexes(indexes);
    indexInstallationMs = performance.now() - start;
  }
  console.log(
    JSON.stringify({
      label,
      phase: "prepared",
      elapsedMs: performance.now() - preparation,
      indexInstallationMs,
      tickets: rows.length,
      bodyBytes: rows[0].content.length,
      requests: requests.length,
      outcomes: requests.length,
    }),
  );
  const statistics = async () => {
    await fixture.db.execute(sql`select pg_stat_force_next_flush()`);
    const result = await fixture.db.execute(
      sql`select coalesce(sum(seq_tup_read),0) as sequential, coalesce(sum(idx_tup_fetch),0) as indexed from pg_stat_user_tables where relname='storage_current_records'`,
    );
    return { sequential: Number(result.rows[0].sequential), indexed: Number(result.rows[0].indexed) };
  };
  for (let index = 0; index < 10; index++) {
    const statsBefore = await statistics();
    counts = {};
    const cpu = process.cpuUsage();
    const start = performance.now();
    const [content, tree] = await Promise.all([
      getTicketContent(ctx, { resource: { type: "ticket", id: "ticket-0" } }),
      readTicketTreeData(ctx, { ...rows[0], shorthand: "T-ticket-0" }),
    ]);
    if (content.content !== rows[0].content || tree.reviewRequests.requests.length !== 1)
      throw Error("Incorrect content or reviews");
    const used = process.cpuUsage(cpu);
    const elapsedMs = performance.now() - start;
    const statsAfter = await statistics();
    console.log(
      JSON.stringify({
        label,
        phase: "sample",
        index,
        elapsedMs,
        cpuMs: (used.user + used.system) / 1000,
        materialized: counts,
        ticketRows: tree.tickets.length,
        visitedRows: {
          sequential: statsAfter.sequential - statsBefore.sequential,
          indexed: statsAfter.indexed - statsBefore.indexed,
        },
      }),
    );
  }
} catch (error) {
  console.error("Ticket opening diagnostic failed", error);
  throw error;
} finally {
  await fixture.close();
}
