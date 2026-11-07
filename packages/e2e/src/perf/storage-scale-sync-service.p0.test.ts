import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readScaleSyncService, scaleSyncServicePath } from "./storage-scale-sync-service";

const withHome = (run: (home: string) => void) => {
  const home = mkdtempSync(join(tmpdir(), "scale-sync-service-"));
  try {
    mkdirSync(join(home, "sync-fixture"));
    run(home);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
};

const descriptor = (pid: number, state = "ready") => ({
  state,
  pid,
  binarySha256: "other-build",
  control: "http://127.0.0.1:1",
  environment: {},
  remote: { baseUrl: "http://127.0.0.1:2", descriptor: {} },
  remoteHome: "/remote",
  preparedMs: 1,
});

test("sync cases refuse a missing, stopped or unprepared sync service", () => {
  withHome((home) => {
    expect(() => readScaleSyncService(home)).toThrow("--prepare-sync");
    const exited = Bun.spawnSync([process.execPath, "--eval", ""]).pid;
    writeFileSync(scaleSyncServicePath(home), JSON.stringify(descriptor(exited)));
    expect(() => readScaleSyncService(home)).toThrow("no longer running");
    writeFileSync(scaleSyncServicePath(home), JSON.stringify(descriptor(process.pid, "preparing")));
    expect(() => readScaleSyncService(home)).toThrow("still preparing");
  });
});
