// Manual benchmark for PRD 0014 R23: relay storage for one document after 10,000 updates.
// Run with `bun run --cwd services/relay bench:storage-bound`. It is not part of CI.
// It starts throwaway PostgreSQL and RustFS containers on loopback ports and removes them afterwards.

import { recordMeasurement } from "pstdio-benchmarks/writer";
import { createSyncFixture, encode, randomId } from "../src/storage/sync-fixture";

const updates = 10_000;
// The client trigger from PRD 0014: a new latest state after 1,000 updates.
const updatesPerState = 1000;
const updateBytes = 120;
const run = `relay-bench-${crypto.randomUUID().slice(0, 8)}`;

const docker = async (...args: string[]) => {
  const child = Bun.spawn(["docker", ...args], { stdout: "pipe", stderr: "pipe" });
  const output = await new Response(child.stdout).text();
  if ((await child.exited) !== 0)
    throw new Error(`docker ${args[0]} failed: ${await new Response(child.stderr).text()}`);
  return output.trim();
};
const port = async (name: string, inner: number) => (await docker("port", name, String(inner))).split(":").at(-1)!;
const until = async (ready: () => Promise<boolean>, what: string) => {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (await ready().catch(() => false)) return;
    await Bun.sleep(500);
  }
  throw new Error(`${what} did not become ready`);
};

const database = `${run}-postgres`;
const objects = `${run}-objects`;
try {
  await docker(
    "run",
    "-d",
    "--rm",
    "--name",
    database,
    "-p",
    "127.0.0.1::5432",
    "-e",
    "POSTGRES_DB=bench",
    "-e",
    "POSTGRES_USER=bench",
    "-e",
    "POSTGRES_PASSWORD=bench-only",
    "postgres:16-alpine",
  );
  await docker(
    "run",
    "-d",
    "--rm",
    "--name",
    objects,
    "-p",
    "127.0.0.1::9000",
    "-e",
    "RUSTFS_ACCESS_KEY=conformance-access",
    "-e",
    "RUSTFS_SECRET_KEY=conformance-secret-only",
    "-e",
    "RUSTFS_CONSOLE_ENABLE=false",
    "rustfs/rustfs:1.0.1",
    "/data",
  );
  const endpoint = `http://127.0.0.1:${await port(objects, 9000)}`;
  process.env.SYNC_TEST_DATABASE_URL = `postgres://bench:bench-only@127.0.0.1:${await port(database, 5432)}/bench`;
  process.env.SYNC_TEST_OBJECT_ENDPOINT = endpoint;
  process.env.NO_PROXY = "127.0.0.1,localhost";
  await until(
    async () => (await docker("exec", database, "pg_isready", "-U", "bench", "-d", "bench")) !== "",
    "PostgreSQL",
  );
  await until(async () => (await fetch(`${endpoint}/health`)).ok, "RustFS");

  const fixture = createSyncFixture();
  await fixture.initialize();
  // Default limits, including the seven-day grace period.
  const { sync } = fixture.open();
  const address = { projectKey: randomId("project"), spaceOwner: null, documentId: randomId("doc") };
  const device = { accountId: randomId("account"), deviceId: randomId("device") };
  let previous = { stateId: null as string | null, bytes: 0 };
  const samples = [];
  const started = performance.now();
  for (let sequence = 1; sequence <= updates; sequence++) {
    await sync.documents.appendUpdate(address, device, {
      updateId: randomId("update"),
      payload: encode(crypto.getRandomValues(new Uint8Array(updateBytes))),
      blobIds: [],
    });
    if (sequence % updatesPerState) continue;
    // Worst case for the bound: the state keeps every edit's bytes, so it never shrinks.
    const payload = crypto.getRandomValues(new Uint8Array(updateBytes * sequence));
    const replaced = await sync.documents.replaceState(address, device, {
      stateId: randomId("state"),
      baseStateId: previous.stateId,
      through: sequence,
      payload: encode(payload),
      summary: encode(new Uint8Array(16)),
      blobIds: [],
    });
    await sync.cleanup();
    // The grace-period copy is the replaced state and the updates after it (R20).
    const graceCopy = previous.bytes + updatesPerState * updateBytes;
    const stored = await fixture.storedBytes();
    samples.push({
      updates: sequence,
      latestState: payload.byteLength,
      graceCopy,
      stored,
      limit: 2 * payload.byteLength + graceCopy,
    });
    previous = { stateId: replaced.state.stateId, bytes: payload.byteLength };
  }
  const elapsedMs = Math.round(performance.now() - started);
  await fixture.close();
  console.table(samples);
  const passed = samples.every((sample) => sample.stored < sample.limit);
  // Stored bytes must stay below the limit, so the budget for their ratio is 1.
  recordMeasurement({
    metric: "stored-to-limit",
    label: "Peak stored bytes as a share of the limit",
    unit: "share",
    value: Math.max(...samples.map((sample) => sample.stored / sample.limit)),
    budget: 1,
  });
  recordMeasurement({ metric: "updates", label: "Apply 10,000 updates", unit: "ms", value: elapsedMs });
  console.log(
    JSON.stringify(
      {
        scenario:
          "One document receives 10,000 updates with a new latest state every 1,000; cleanup runs after each state.",
        workload: { updates, updatesPerState, updateBytes, gracePeriod: "7 days (default)" },
        metrics: { maxStoredToLimit: Math.max(...samples.map((sample) => sample.stored / sample.limit)), elapsedMs },
        passed,
      },
      null,
      2,
    ),
  );
  if (!passed) process.exitCode = 1;
} finally {
  await Promise.allSettled([docker("rm", "-f", database), docker("rm", "-f", objects)]);
}
