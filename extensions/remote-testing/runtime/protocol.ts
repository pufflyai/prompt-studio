export const RESULT_MARKER = "REMOTE_TEST_RESULT ";
export interface RunRequest {
  type: "pocketcoder.remote-test/v1";
  runId: string;
  source: { url: string; sha256: string };
  command: string;
  timeoutSeconds: number;
  log: { url: string };
}
export interface RunResult {
  runId: string | null;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
  logUploaded: boolean;
  error?: string;
}
export function parseRequest(message: string) {
  const request = JSON.parse(message.split("\n\n")[0] ?? "") as RunRequest;
  if (
    request.type !== "pocketcoder.remote-test/v1" ||
    !/^[0-9a-f-]{36}$/i.test(request.runId) ||
    !/^[0-9a-f]{64}$/.test(request.source?.sha256) ||
    typeof request.command !== "string" ||
    !request.command.length ||
    request.command.length > 4096 ||
    !Number.isInteger(request.timeoutSeconds) ||
    request.timeoutSeconds <= 0 ||
    request.timeoutSeconds > 6 * 3600
  )
    throw new Error("Invalid remote test request.");
  for (const url of [request.source.url, request.log?.url]) {
    if (!["https:", "http:"].includes(new URL(url).protocol)) throw new Error("Invalid transfer URL.");
  }
  return request;
}
