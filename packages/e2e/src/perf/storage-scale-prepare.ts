import { assertMeasurementWindow, completeBenchmarkWorker, type Workload } from "storage-scale-fixture";
import { writeFixture } from "./storage-scale-artifacts";
import { refreshScaleSources, seedScaleRuntime } from "./storage-scale-runtime";
import { verifyScaleFixture } from "./storage-scale-verify";

if (process.env.PSTDIO_SCALE_SUPERVISOR_PID !== String(process.ppid))
  throw new Error("Run preparation through the external storage-scale controller");
assertMeasurementWindow();
const [action, root, home, kind, churn] = process.argv.slice(2);
const emit = (row: object) => console.log(JSON.stringify(row));
await completeBenchmarkWorker(async () => {
  emit({ phase: "preparation-start", action, acceptedTiming: false });
  if (action === "--emit-fixture") {
    const fixture = await writeFixture(root, kind as Workload);
    emit({ phase: "fixture", ...fixture, scenarios: undefined });
  } else if (action === "--seed") {
    await writeFixture(root, kind as Workload);
    emit({ phase: "seed", ...(await seedScaleRuntime(home, kind as Workload, churn === "true")) });
    await refreshScaleSources(home, kind as Workload);
    emit({ phase: "stored-fixture", ...(await verifyScaleFixture(home, kind as Workload)) });
  } else if (action === "--refresh-source") await refreshScaleSources(home, kind as Workload);
  else if (action === "--verify-fixture")
    emit({ phase: "stored-fixture", ...(await verifyScaleFixture(home, kind as Workload)) });
  else throw new Error("Unknown preparation action");
});
