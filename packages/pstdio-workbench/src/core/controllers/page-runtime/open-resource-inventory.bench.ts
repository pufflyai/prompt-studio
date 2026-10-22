import { recordMeasurement, recordPeakMemory } from "pstdio-benchmarks/writer";
import { createDefaultWorkbenchLayout } from "../../registries/layout/layout-types";
import { createWorkbenchLayoutCache } from "./workbench-layout-cache";

const count = 10_000;
const empty = createDefaultWorkbenchLayout();
const saved = Array.from({ length: count }, (_, index) => {
  const id = `session-${index}`;
  return JSON.stringify({
    ...empty,
    regions: {
      ...empty.regions,
      main: {
        ...empty.regions.main,
        widgets: [{ widgetId: id, contributionId: "session", resource: { type: "session", id } }],
      },
    },
  });
});
let enumerations = 0;
const cache = createWorkbenchLayoutCache({
  layoutPersistence: {
    getLayout: (scope) => (scope ? JSON.parse(saved[Number(scope)]) : undefined),
    setLayout: () => {},
    listLayouts: () => {
      enumerations++;
      return saved.map((raw, index) => ({ scope: String(index), layout: JSON.parse(raw) }));
    },
  },
});
const started = performance.now();
const ids = cache.placementIds(empty);
const restored = performance.now();
const resources = cache.listResources(empty);
const samples = [];
for (let iteration = 0; iteration < 1000; iteration++) {
  const start = performance.now();
  if (!cache.placementIds(empty).has("session-9999")) throw new Error("Missing retained session");
  if (cache.listResources(empty) !== resources) throw new Error("Unchanged resource inventory was rebuilt");
  samples.push(performance.now() - start);
}
if (ids.size !== count || enumerations !== 1) throw new Error("Saved sessions were not restored once");
samples.sort((a, b) => a - b);
recordMeasurement({ metric: "restore", label: "Restore 10,000 open resources", unit: "ms", value: restored - started });
recordMeasurement({
  metric: "lookup-p95",
  label: "Open-resource lookup, p95",
  unit: "ms",
  value: samples[Math.ceil(samples.length * 0.95) - 1],
});
recordPeakMemory("open-resources-memory", "Open resources peak memory");
console.info(
  JSON.stringify({
    sessions: count,
    restoreMs: restored - started,
    lookups: samples.length,
    medianLookupMs: samples[Math.floor(samples.length / 2)],
    p95LookupMs: samples[Math.ceil(samples.length * 0.95) - 1],
    storageEnumerations: enumerations,
  }),
);
