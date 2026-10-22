import { appendFileSync } from "node:fs";
import type { StorageDiagnostic, StorageDiagnostics } from "./storage-diagnostics";

export const createStorageDiagnosticSink = (path: string) => {
  let sequence = 0;
  const write = (event: object) => {
    // Synchronous append bounds memory and makes completed events visible to the external harness.
    appendFileSync(
      path,
      `${JSON.stringify({
        ...event,
        capture: "storage",
        processId: process.pid,
        sequence: ++sequence,
        monotonicMs: performance.now(),
        timeOriginMs: performance.timeOrigin,
      })}\n`,
    );
  };
  write({ phase: "capture-start" });
  return (event: StorageDiagnostic) => write(event);
};

let runtimeDiagnostics: StorageDiagnostics | undefined;
export const runtimeStorageDiagnostics = () => {
  const path = process.env.PSTDIO_STORAGE_DIAGNOSTICS_PATH;
  if (!path) return;
  runtimeDiagnostics ??= createStorageDiagnosticSink(path);
  return runtimeDiagnostics;
};
