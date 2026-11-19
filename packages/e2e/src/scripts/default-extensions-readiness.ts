import type { ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { waitForProcessReady } from "./process-readiness";

/** Activated source files can still roll back until the startup request commits. */
export const waitForDefaultExtensions = (child: ChildProcess, logPath: string) =>
  waitForProcessReady(child, "Default tools installed", async () => {
    if (!existsSync(logPath)) return undefined;
    const entries = readFileSync(logPath, "utf8")
      .split("\n")
      .filter((line) => line.startsWith("{"))
      .map((line) => JSON.parse(line));
    const start = entries.find(
      (entry) =>
        entry.event === "runtime.setup.phase" &&
        entry.phase === "default_extensions.request" &&
        entry.state === "started",
    );
    return start && entries.some((entry) => entry.span_id === start.span_id && entry.state === "completed")
      ? true
      : undefined;
  });
