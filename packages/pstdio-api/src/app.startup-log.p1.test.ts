import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { createTestApp } from "./test-utils/create-test-app";

test.each([
  { mode: "API thread", databaseWorker: false },
  { mode: "database worker", databaseWorker: true },
])("startup logs each step at the default level with the $mode", async ({ databaseWorker }) => {
  const logPath = process.env.PSTDIO_LOG_PATH as string;
  const previousLines = existsSync(logPath) ? readFileSync(logPath, "utf8").split("\n").filter(Boolean).length : 0;
  const app = await createTestApp({ databasePath: ":memory:", databaseWorker });
  // Readiness excludes background discovery; let that phase finish before requesting shutdown.
  try {
    while (
      !readFileSync(logPath, "utf8")
        .split("\n")
        .slice(previousLines)
        .some((line) => line.includes('"phase":"extensions_ready"'))
    )
      await Bun.sleep(10);
  } finally {
    await app.close();
  }

  const phases = readFileSync(logPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .slice(previousLines)
    .map((line) => JSON.parse(line) as { event?: string; phase?: string; elapsedMs?: number })
    .filter((entry) => entry.event === "runtime.startup.phase");

  expect(phases.slice(0, 5).map((entry) => entry.phase)).toEqual([
    "database_locked",
    "database_engine_loaded",
    "database_opened",
    "database_index_nodes",
    "database_migrated",
  ]);
  expect(
    phases
      .slice(5)
      .map((entry) => entry.phase)
      .sort(),
  ).toEqual(["app_ready", "extensions_ready"]);
  const elapsed = phases.map((entry) => entry.elapsedMs as number);
  expect(elapsed).toEqual([...elapsed].sort((left, right) => left - right));
});
