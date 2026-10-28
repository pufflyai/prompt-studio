import { recordMeasurement, recordPeakMemory } from "pstdio-benchmarks/writer";
import { createHarnessSessionResources, SESSION_RESOURCE_RETENTION_MS } from "./harness-session-resources";

const count = 10_000;
let now = 0;
let expire: (() => void) | undefined;
let scheduled = 0;
let released = 0;
const resources = createHarnessSessionResources({
  now: () => now,
  schedule: (run) => {
    expire = run;
    scheduled++;
    return () => {
      expire = undefined;
    };
  },
});
const owner = {};
const retained = [];
const cpu = process.cpuUsage();
const started = performance.now();
for (let index = 0; index < count; index++) {
  const id = `session-${index}`;
  retained.push(resources.retain(id));
  const done = await resources.acquire(owner, id, async () => {
    released++;
    return true;
  });
  done();
}
const acquired = performance.now();
for (const close of retained) close();
const closed = performance.now();
now = SESSION_RESOURCE_RETENTION_MS;
expire?.();
for (let pass = 0; pass < 20; pass++) await Promise.resolve();
const expired = performance.now();
const used = process.cpuUsage(cpu);
if (released !== count) throw new Error(`Released ${released} of ${count} idle sessions`);
await resources.retire(owner);
recordMeasurement({ metric: "acquire", label: "Acquire 10,000 sessions", unit: "ms", value: acquired - started });
recordMeasurement({ metric: "close", label: "Close 10,000 sessions", unit: "ms", value: closed - acquired });
recordMeasurement({ metric: "expire", label: "Expire idle sessions", unit: "ms", value: expired - closed });
recordPeakMemory("session-resources-memory", "Session resources peak memory");
console.info(
  JSON.stringify({
    sessions: count,
    acquireMs: acquired - started,
    closeMs: closed - acquired,
    expireMs: expired - closed,
    cpuMs: (used.user + used.system) / 1000,
    cleanupTimersScheduled: scheduled,
    released,
  }),
);
