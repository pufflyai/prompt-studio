// PowerShell startup must not compete with PGlite cold starts. Keep this boundary
// in the scheduler so every API suite caller follows the same isolation rule.
const runsAlone = (file: string) => /\.exclusive\.p[0-3]\.test\.ts$/.test(file);

interface SchedulerOptions {
  priority?: string;
  signal?: AbortSignal;
  // A file that blocks its process never reaches Bun's per-test timeout (PS-1013).
  // After this long its signal aborts with "stalled", so the caller can record and stop it.
  stallMs?: number;
}
interface FileResult {
  file: string;
  outcome: "success" | "failure" | "cancelled";
  exitCode: number | null;
  durationMs: number | null;
  error?: string;
  cancellationReason?: string;
}

export const runApiTestFiles = async (
  files: string[],
  runFile: (file: string, signal: AbortSignal) => Promise<number>,
  options: SchedulerOptions = {},
) => {
  const priority = options.priority ?? process.env.CI_PRIORITY ?? "P1";
  const controller = new AbortController();
  const cancel = () => controller.abort(options.signal?.reason ?? "user-cancellation");
  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const results: FileResult[] = files.map((file) => ({ file, outcome: "cancelled", exitCode: null, durationMs: null }));
  const run = async (file: string) => {
    if (controller.signal.aborted) return;
    const result = results[files.indexOf(file)]!;
    const started = performance.now();
    const fileController = new AbortController();
    const stop = () => fileController.abort(controller.signal.reason);
    controller.signal.addEventListener("abort", stop, { once: true });
    const stall = options.stallMs ? setTimeout(() => fileController.abort("stalled"), options.stallMs) : undefined;
    try {
      result.exitCode = await runFile(file, fileController.signal);
      result.outcome = result.exitCode === 0 ? "success" : "failure";
      if (controller.signal.aborted) result.outcome = "cancelled";
    } catch (error) {
      result.outcome = controller.signal.aborted ? "cancelled" : "failure";
      result.error = String(error);
      console.error(`${file}: ${result.error}`);
    } finally {
      clearTimeout(stall);
      controller.signal.removeEventListener("abort", stop);
      result.durationMs = performance.now() - started;
    }
    if (fileController.signal.reason === "stalled" && !controller.signal.aborted && result.exitCode !== 0) {
      result.outcome = "failure";
      result.error = `stalled for ${options.stallMs! / 1000} s`;
      console.error(`${file}: ${result.error}`);
    }
    if (result.outcome === "failure" && priority === "P1") controller.abort("p1-failure");
  };
  const shared = files.filter((file) => !runsAlone(file));
  let next = 0;
  const worker = async () => {
    while (!controller.signal.aborted && next < shared.length) await run(shared[next++]!);
  };
  try {
    await Promise.all([worker(), worker()]);
    for (const file of files.filter(runsAlone)) {
      if (controller.signal.aborted) break;
      console.log(`API test file (running alone): ${file}`);
      await run(file);
    }
    for (const result of results) {
      if (result.outcome === "cancelled") result.cancellationReason = String(controller.signal.reason ?? "not-started");
    }
    return results;
  } finally {
    options.signal?.removeEventListener("abort", cancel);
  }
};
