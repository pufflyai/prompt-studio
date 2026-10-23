import { readFileSync } from "node:fs";
import { assertMeasurementWindow, completeBenchmarkWorker } from "storage-scale-fixture";
import { type ScaleSampleCase, sampleScaleScenario } from "./storage-scale-samples";

if (process.env.PSTDIO_SCALE_SUPERVISOR_PID !== String(process.ppid))
  throw new Error("Run sample cases through the external storage-scale controller");
assertMeasurementWindow();
const input = JSON.parse(readFileSync(process.argv[2], "utf8")) as ScaleSampleCase;
await completeBenchmarkWorker(() => sampleScaleScenario(input, (row) => console.log(JSON.stringify(row))));
