/** A standalone cost profile, not a test or a replacement execution allowance. */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb, createExtensionStorageDBService, projects } from "pstdio-db";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createSessionLogFiles } from "./log-files";
import { logRelayFixture } from "./log-transport.fixture";
import { createPersonalHistoryStore } from "./store";

type MeasuredClient = { query(sql: string, ...args: unknown[]): Promise<unknown> };
interface MeasuredDatabase extends MeasuredClient {
  transaction<T>(callback: (client: MeasuredClient) => Promise<T>, ...args: unknown[]): Promise<T>;
}
const root = await mkdtemp(join(tmpdir(), "private-history-profile-"));
const connection = await createDb({ path: join(root, "database") });
const client = connection.pglite as unknown as MeasuredDatabase;
const queries = new Map<string, { count: number; ms: number; maxMs: number }>();
const measured = new WeakSet<object>();
const instrument = (target: MeasuredClient) => {
  if (measured.has(target)) return;
  measured.add(target);
  const query = target.query.bind(target);
  target.query = async (sql, ...args) => {
    const started = performance.now();
    try {
      return await query(sql, ...args);
    } finally {
      const key = String(sql).replace(/\s+/g, " ");
      const stat = queries.get(key) ?? { count: 0, ms: 0, maxMs: 0 };
      const ms = performance.now() - started;
      stat.count++;
      stat.ms += ms;
      stat.maxMs = Math.max(stat.maxMs, ms);
      queries.set(key, stat);
    }
  };
};
instrument(client);
const transactions = { count: 0, totalMs: 0, callbackMs: 0, maxMs: 0 };
const transaction = client.transaction.bind(client);
client.transaction = async <T>(callback: (target: MeasuredClient) => Promise<T>, ...args: unknown[]) => {
  const started = performance.now();
  transactions.count++;
  try {
    return await transaction(
      async (target) => {
        instrument(target);
        const entered = performance.now();
        try {
          return await callback(target);
        } finally {
          transactions.callbackMs += performance.now() - entered;
        }
      },
      ...args,
    );
  } finally {
    const ms = performance.now() - started;
    transactions.totalMs += ms;
    transactions.maxMs = Math.max(transactions.maxMs, ms);
  }
};
try {
  const now = new Date().toISOString();
  await connection.db.insert(projects).values({
    id: "project",
    name: "Profile",
    shorthand: "P",
    created_at: now,
    updated_at: now,
  });
  const storage = createExtensionStorageDBService(connection.db);
  const history = createPersonalHistoryStore({
    projectId: "project",
    accountId: "alice",
    managerOrigin: "https://manager.example",
    documents: storage.documents,
    files: createSessionLogFiles(root),
    index: storage.personalHistoryIndex,
    logs: storage.logs,
  });
  const device = { ownerId: "alice", id: await storage.logs.writerId(), name: "Laptop" };
  const space = await createSyncSpace({
    projectId: "project",
    spaceOwner: "alice",
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const peer = logRelayFixture();
  const started = performance.now();
  const cpu = process.cpuUsage();
  let patchMs = 0;
  let syncMs = 0;
  let peakRss = process.memoryUsage().rss;
  for (let index = 0; index < 1000; index++) {
    let mark = performance.now();
    await history.patchRecords("sessions", device, [{ id: "session", title: `Edit ${index}` }]);
    patchMs += performance.now() - mark;
    mark = performance.now();
    await history.synchronizeIndex(device.id, true, space, peer.relay);
    syncMs += performance.now() - mark;
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
    if ((index + 1) % 100 === 0)
      console.error(
        JSON.stringify({ published: index + 1, elapsedMs: performance.now() - started, memory: process.memoryUsage() }),
      );
  }
  const publicationMs = performance.now() - started;
  await storage.logs.flushStatistics();
  console.log(
    JSON.stringify(
      {
        platform: process.platform,
        arch: process.arch,
        bun: Bun.version,
        publications: 1000,
        snapshots: peer.states.size,
        totalMs: performance.now() - started,
        publicationMs,
        patchMs,
        syncMs,
        cpu: process.cpuUsage(cpu),
        peakRss,
        memory: process.memoryUsage(),
        transactions,
        outsideCallbackMs: transactions.totalMs - transactions.callbackMs,
        sql: [...queries].map(([sql, stat]) => ({ sql, ...stat })).sort((a, b) => b.ms - a.ms),
      },
      null,
      2,
    ),
  );
} finally {
  await connection.close();
  await rm(root, { recursive: true, force: true });
}
