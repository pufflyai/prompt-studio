import { readFileSync, statSync } from "node:fs";

const MAX_DIAGNOSTIC_BYTES = 8_192;

interface StartupDiagnosticsInput {
  autostartId: string;
  logPath: string;
  offset: number;
}

type LogEntry = {
  autostartId?: unknown;
  err?: { message?: unknown; stack?: unknown };
  level?: unknown;
  message?: unknown;
  msg?: unknown;
  stack?: unknown;
};

const asText = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : null);

const entryDetails = (entry: LogEntry) =>
  [entry.message, entry.err?.message, entry.msg, entry.stack, entry.err?.stack]
    .map(asText)
    .filter((value): value is string => value !== null);

export const resolveStartupLogOffset = (logPath: string) => {
  try {
    return statSync(logPath).size;
  } catch {
    return 0;
  }
};

export const readStartupDiagnostics = (input: StartupDiagnosticsInput) => {
  let appended: string;
  try {
    const log = readFileSync(input.logPath);
    const offset = input.offset <= log.length ? input.offset : 0;
    appended = log.subarray(offset).toString("utf8");
  } catch {
    return "";
  }

  const details = new Set<string>();
  for (const line of appended.split("\n")) {
    if (!line) continue;

    try {
      const entry = JSON.parse(line) as LogEntry;
      if (entry.autostartId !== input.autostartId || typeof entry.level !== "number" || entry.level < 50) continue;
      for (const detail of entryDetails(entry)) details.add(detail);
    } catch {
      // A process may still be completing the final JSONL record while startup is being inspected.
    }
  }

  return [...details].join("\n").slice(0, MAX_DIAGNOSTIC_BYTES);
};
