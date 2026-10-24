/** The process was asked to stop while exporting. The export is incomplete and must run again. */
export class ExportInterruptedError extends Error {
  constructor() {
    super("Database export worker was interrupted");
    this.name = "ExportInterruptedError";
  }
}

export const runExportWorker = async (options: { entry: string; args: string[]; signal?: AbortSignal }) => {
  options.signal?.throwIfAborted();
  const child = Bun.spawn([process.execPath, options.entry, ...options.args], {
    env: { ...process.env, BUN_BE_BUN: "1" },
    stdout: "pipe",
    stderr: "pipe",
  });
  let interrupted = false;
  const stop = () => {
    interrupted = true;
    child.kill("SIGTERM");
  };
  options.signal?.addEventListener("abort", stop, { once: true });
  if (options.signal?.aborted) stop();
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  try {
    const [code, output, error] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    options.signal?.throwIfAborted();
    if (interrupted) throw new ExportInterruptedError();
    if (code !== 0) throw new Error(`Database export worker failed (${code}): ${error || output}`);
    if (JSON.parse(output.trim()).completed !== true)
      throw new Error("Database export worker did not confirm completion");
  } finally {
    options.signal?.removeEventListener("abort", stop);
    process.off("SIGTERM", stop);
    process.off("SIGINT", stop);
  }
};
