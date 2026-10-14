import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createTestApp } from "./test-utils/create-test-app";

test("startup logs each step with the time since the process started at the default log level", async () => {
  const app = await createTestApp({ databasePath: ":memory:" });
  await app.close();

  const phases = readFileSync(process.env.PSTDIO_LOG_PATH as string, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { event?: string; phase?: string; elapsedMs?: number })
    .filter((entry) => entry.event === "runtime.startup.phase");

  expect(phases.map((entry) => entry.phase)).toEqual([
    "database_locked",
    "database_engine_loaded",
    "database_opened",
    "database_migrated",
    "extensions_ready",
    "app_ready",
  ]);
  const elapsed = phases.map((entry) => entry.elapsedMs as number);
  expect(elapsed).toEqual([...elapsed].sort((left, right) => left - right));
});
