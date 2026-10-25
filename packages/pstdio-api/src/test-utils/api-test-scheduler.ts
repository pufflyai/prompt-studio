// PowerShell startup must not compete with PGlite cold starts. Keep this boundary
// in the scheduler so every API suite caller follows the same isolation rule.
const isolatedFiles = new Set(["src/features/extensions/process-discovery.test.ts"]);
const runsAlone = (file: string) => isolatedFiles.has(file.replaceAll("\\", "/"));

interface SchedulerOptions {
  priority?: string;
  signal?: AbortSignal;
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
    try {
      result.exitCode = await runFile(file, controller.signal);
      result.outcome = result.exitCode === 0 ? "success" : "failure";
      if (controller.signal.aborted) result.outcome = "cancelled";
    } catch (error) {
      result.outcome = controller.signal.aborted ? "cancelled" : "failure";
      result.error = String(error);
      console.error(`${file}: ${result.error}`);
    } finally {
      result.durationMs = performance.now() - started;
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
