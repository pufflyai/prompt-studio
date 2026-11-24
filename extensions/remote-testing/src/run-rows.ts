import type { Environment } from "./environments";
import type { RunRecord } from "./runs";

// Table values for one run. Running runs show their elapsed time so far.
export function runValues(record: RunRecord, sessionTitle: string | null, now: Date) {
  const summary = record.summary;
  const elapsed = summary?.durationMs ?? now.getTime() - Date.parse(record.startedAt);
  return {
    status: summary?.status ?? "running",
    command: record.command,
    session: sessionTitle ?? sessionFallback(record.sessionId),
    environment: record.environmentId.slice(0, 8),
    started: record.startedAt,
    duration: Math.round(elapsed / 1000),
    exitCode: summary?.exitCode ?? null,
    log: summary?.logPath ?? summary?.error ?? "",
  };
}

// A session outside this project, or a deleted one, cannot be looked up; show its ID.
function sessionFallback(sessionId: string | undefined) {
  return sessionId ? `Session ${sessionId.slice(0, 8)}` : "Not recorded";
}

// Table values for one environment. `runId` is the run holding it, if any.
export function environmentValues(environment: Environment, runId: string | null, current: string) {
  return {
    environment: environment.id.slice(0, 8),
    state: environment.state,
    activity: runId ? `Running ${runId.slice(0, 8)}` : "Free",
    template: environment.template.version === current ? "Current" : `Older (${environment.template.version})`,
    started: environment.created_at,
    stopsAt: environment.deadline_at,
  };
}
