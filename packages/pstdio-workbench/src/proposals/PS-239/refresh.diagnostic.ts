import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { createWindowedQueryPool } from "./windowed-query";

const args = process.argv.slice(2);
assert(args.includes("--out"), "Pass --out <report filesPath>");
const output = resolve(args[args.indexOf("--out") + 1]);
await mkdir(output, { recursive: true });
const identity = {
  runtime: "ps239",
  project: "fixture",
  extension: "planner",
  permission: "owner",
  query: JSON.stringify({ active: true, fields: ["status", "position"], sort: ["position", "id"] }),
};
const results: unknown[] = [];
for (let pass = 0; pass < 12; pass++) {
  for (const candidate of pass % 2 ? [true, false] : [false, true]) {
    let reads = 0;
    let outstanding = 0;
    let maximumOutstanding = 0;
    let revision = 0;
    const published: number[] = [];
    const publications: { value: number; at: number }[] = [];
    const requests: { value: number; at: number }[] = [];
    const publish = (value: number) => {
      published.push(value);
      publications.push({ value, at: performance.now() });
    };
    const read = async () => {
      reads++;
      outstanding++;
      maximumOutstanding = Math.max(maximumOutstanding, outstanding);
      const value = revision;
      requests.push({ value, at: performance.now() });
      await Bun.sleep(2);
      outstanding--;
      return value;
    };
    const pool = createWindowedQueryPool<number>(25);
    const root = createScopedQueryClient({
      runtimeId: identity.runtime,
      projectId: identity.project,
      extensionId: identity.extension,
    });
    const prototype = pool.query(identity, read);
    assert.equal(pool.query(identity, read), prototype);
    assert.notEqual(pool.query({ ...identity, permission: "another-user" }, read), prototype);
    const control = root.query({ id: identity.query, read });
    const query = candidate ? prototype : control;
    const stop = candidate
      ? prototype.subscribe(publish)
      : control.subscribe(() => {
          const snapshot = control.getSnapshot();
          if (snapshot.data !== undefined && !snapshot.fetching) publish(snapshot.data);
        });
    // Multiple consumers share the same read; one leaving does not cancel another.
    const stopPeer = candidate ? prototype.subscribe(() => {}) : control.subscribe(() => {});
    await query.read();
    const started = performance.now();
    let lastEventAt = started;
    for (let n = 0; n < 20; n++) {
      revision++;
      lastEventAt = performance.now();
      query.invalidate();
      if (n === 5) stopPeer();
      await Bun.sleep(3);
    }
    const eventsEnded = performance.now();
    // Let background freshness settle before asking for the authoritative result.
    await Bun.sleep(60);
    const value = await query.read();
    assert.equal(value, revision);
    assert.equal(maximumOutstanding, 1);
    results.push({
      pass,
      candidate,
      reads,
      maximumOutstanding,
      eventsMs: eventsEnded - started,
      totalMs: performance.now() - started,
      finalFreshnessMs: publications.find((entry) => entry.value === revision)!.at - lastEventAt,
      firstBackgroundReadMs: requests[1].at - started,
      requests,
      published,
      prototypeMetrics: candidate ? { ...prototype.metrics } : undefined,
      scope: "20 synthetic invalidations 3ms apart, 2ms provider; not measured application request timings",
    });
    stop();
    pool.dispose();
    root.dispose();
  }
}

// A delayed stale completion may not publish, even if a peer detaches during it.
const pool = createWindowedQueryPool<number>(25);
const first = Promise.withResolvers<number>();
let calls = 0;
const owner = pool.query(identity, () => (++calls === 1 ? first.promise : Promise.resolve(2)));
const values: number[] = [];
const stop = owner.subscribe((value) => values.push(value));
await Bun.sleep(0);
owner.invalidate();
first.resolve(1);
assert.equal(await owner.read(), 2);
assert.deepEqual(values, [2]);
stop();
pool.dispose();
const failedPool = createWindowedQueryPool<number>(25);
const obsoleteFailure = Promise.withResolvers<number>();
let failedCalls = 0;
const failedOwner = failedPool.query(identity, () =>
  ++failedCalls === 1 ? obsoleteFailure.promise : Promise.resolve(3),
);
const failureValues: number[] = [];
const stopFailed = failedOwner.subscribe((value) => failureValues.push(value));
await Bun.sleep(0);
failedOwner.invalidate();
obsoleteFailure.reject(new Error("obsolete failure"));
assert.equal(await failedOwner.read(), 3);
assert.deepEqual(failureValues, [3]);
stopFailed();
failedPool.dispose();
await Bun.write(resolve(output, "samples.json"), JSON.stringify(results, null, 2));
await Bun.write(
  resolve(output, "correctness.json"),
  JSON.stringify(
    {
      staleSuppression: true,
      staleFailureSuppression: true,
      sharedOwner: true,
      permissionIsolation: true,
      disposal: true,
      peerDisposal: true,
      maximumOutstanding: 1,
      limitations: [
        "pool is experiment-owned and explicitly disposed; no production inactive-owner eviction",
        "fixed synthetic provider duration",
        "schema/configuration event separation not integrated",
      ],
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ output, samples: results.length, status: "passed" }));
