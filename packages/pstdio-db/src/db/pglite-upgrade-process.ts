export const runUpgradeWorker = async (options: { entry: string; args: string[]; signal?: AbortSignal }) => {
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
    if (interrupted) throw new Error("Database upgrade worker was interrupted");
    if (code !== 0) throw new Error(`Database ${options.args[0]} worker failed (${code}): ${error || output}`);
    const result = JSON.parse(output.trim());
    if (result.completed !== true || result.phase !== options.args[0])
      throw new Error("Database worker did not confirm completion");
  } finally {
    options.signal?.removeEventListener("abort", stop);
    process.off("SIGTERM", stop);
    process.off("SIGINT", stop);
  }
};
