import { expect, test } from "bun:test";
import { readRuntimeStartupPhase } from "./runtime-startup-progress";

const log = (phase: string) => JSON.stringify({ event: "runtime.startup.phase", phase, elapsedMs: 10 });

test("shows the work following the latest completed startup step", () => {
  expect(readRuntimeStartupPhase(log("database_locked"))).toBe("database");
  expect(readRuntimeStartupPhase(log("database_engine_loaded"))).toBe("database");
  expect(readRuntimeStartupPhase(log("database_upgrade_copying"))).toBe("upgrade_copying");
  expect(readRuntimeStartupPhase(log("database_upgrade_exporting"))).toBe("upgrade_exporting");
  expect(readRuntimeStartupPhase(log("database_upgrade_importing"))).toBe("upgrade_importing");
  expect(readRuntimeStartupPhase(log("database_image_restored"))).toBe("database");
  expect(readRuntimeStartupPhase(log("database_opened"))).toBe("migrations");
  expect(readRuntimeStartupPhase(log("database_migrated"))).toBe("extensions");
  expect(readRuntimeStartupPhase(log("extensions_ready"))).toBe("readiness");
  expect(readRuntimeStartupPhase(log("app_ready"))).toBe("readiness");
});

test("reads progress from a bounded log tail without exposing unrelated output", () => {
  const output = [
    'partial log entry"}',
    log("database_opened"),
    log("database_migrated"),
    JSON.stringify({ event: "runtime.startup.phase", phase: "unknown" }),
    JSON.stringify({ event: "unrelated", phase: "app_ready", token: "private" }),
    '{"event":"runtime.startup.phase",',
  ].join("\n");

  expect(readRuntimeStartupPhase(output)).toBe("extensions");
  expect(readRuntimeStartupPhase("unrelated process output")).toBeUndefined();
});
