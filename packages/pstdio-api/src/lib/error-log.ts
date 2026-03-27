import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ErrorLogEntry {
  level: string;
  timestamp: string;
  method: string;
  path: string;
  status: number;
  message: string;
  stack?: string;
}

const MAX_LOG_FILES = 50;

export function logError<T extends object>(entry: T) {
  process.stderr.write(`${JSON.stringify(entry)}\n`);
}

export function persistErrorLog<T extends { timestamp: string }>(entry: T, logDir?: string) {
  const dir = logDir ?? join(homedir(), ".pstdio", "error-logs");

  try {
    mkdirSync(dir, { recursive: true });

    const filename = `${entry.timestamp.replace(/:/g, "-")}.json`;
    writeFileSync(join(dir, filename), `${JSON.stringify(entry, null, 2)}\n`);

    const files = readdirSync(dir).sort();
    while (files.length > MAX_LOG_FILES) {
      const oldest = files.shift()!;
      unlinkSync(join(dir, oldest));
    }
  } catch (err) {
    process.stderr.write(`Failed to persist error log: ${(err as Error).message}\n`);
  }
}

export function persistStartupError(error: Error, logDir?: string) {
  const entry = {
    source: "startup" as const,
    level: "error" as const,
    timestamp: new Date().toISOString(),
    message: error.message,
    stack: error.stack,
  };

  logError(entry);
  persistErrorLog(entry, logDir);
}
