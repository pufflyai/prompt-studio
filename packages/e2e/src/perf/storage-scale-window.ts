import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { platform } from "node:os";
import { assertMeasurementWindow } from "storage-scale-fixture";

const inventory = () => {
  // Command names avoid persisting bearer tokens from unrelated command arguments.
  if (platform() === "win32") return execFileSync("tasklist", ["/FO", "CSV"], { encoding: "utf8" });
  return execFileSync("ps", ["-axo", "pid=,ppid=,pcpu=,comm="], { encoding: "utf8" });
};

export const enterMeasurementWindow = (ownerPath: string, emit: (data: object) => void) => {
  const owner = JSON.parse(readFileSync(ownerPath, "utf8")) as { sessionId: string; token: string };
  process.env.PSTDIO_TIMING_SESSION_ID = owner.sessionId;
  process.env.PSTDIO_TIMING_TOKEN = owner.token;
  const lease = assertMeasurementWindow();
  emit({ phase: "timing-window-enter", lease, inventory: inventory(), acceptedTiming: false });
  return () => {
    const current = assertMeasurementWindow();
    emit({ phase: "timing-window-exit", lease: current, inventory: inventory(), endedAt: new Date().toISOString() });
  };
};
