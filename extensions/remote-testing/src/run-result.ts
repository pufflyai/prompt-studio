import type { RunCollectionDeps, RunRecord, RunSummary } from "./runs";

export interface Receipt {
  finalizedAt?: string | null;
  cancel?: { cancelId: string } | null;
  acceptance: { execution: Record<string, unknown> };
  outcome?: { status?: string; finalResponse?: string } | null;
}

const MARKER = "REMOTE_TEST_RESULT ";
const TAIL_LINES = 60;
const logs = (runId: string) => `logs/${runId}.log`;
export function timeoutSummary(record: RunRecord) {
  return {
    runId: record.runId,
    environmentId: record.environmentId,
    status: "timed_out",
    exitCode: null,
    durationMs: Date.now() - Date.parse(record.startedAt),
    logPath: null,
    tail: "",
    error: "The remote runner did not return a final receipt before the run deadline.",
  } satisfies RunSummary;
}

export async function summarize(
  deps: RunCollectionDeps,
  record: RunRecord,
  receipt: Receipt,
  signal?: AbortSignal,
  retryTransient = false,
): Promise<RunSummary> {
  const response = receipt.outcome?.finalResponse ?? "";
  const line = response.split("\n").find((text) => text.startsWith(MARKER));
  const result = line
    ? (JSON.parse(line.slice(MARKER.length)) as {
        exitCode: number | null;
        durationMs: number;
        timedOut: boolean;
        error?: string;
      })
    : null;
  const log = await deps.storage.download(logs(record.runId), { signal, retryTransient });
  const text = log ? new TextDecoder().decode(log) : "";
  const logPath = log ? await deps.saveLog(record.runId, text) : null;
  const base = {
    runId: record.runId,
    environmentId: record.environmentId,
    exitCode: result?.exitCode ?? null,
    durationMs: result?.durationMs ?? Date.now() - Date.parse(record.startedAt),
    logPath,
    tail: text.split("\n").slice(-TAIL_LINES).join("\n"),
  };
  if (receipt.outcome?.status === "canceled") return { ...base, status: "canceled" };
  if (!result) return { ...base, status: "error", error: response || JSON.stringify(receipt.outcome) };
  if (result.error) return { ...base, status: "error", error: result.error };
  if (result.timedOut) return { ...base, status: "timed_out" };
  return { ...base, status: result.exitCode === 0 ? "passed" : "failed" };
}
