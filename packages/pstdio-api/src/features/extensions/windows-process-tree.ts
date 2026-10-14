const runTaskkill = async (pid: number) => {
  const taskkill = Bun.spawn(["taskkill.exe", "/PID", String(pid), "/T", "/F"], {
    stdout: "pipe",
    stderr: "pipe",
    windowsHide: true,
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    taskkill.exited,
    new Response(taskkill.stdout).text(),
    new Response(taskkill.stderr).text(),
  ]);
  return { exitCode, output: stdout + stderr };
};

interface ProcessTreeRoot {
  pid: number;
  exited: Promise<unknown>;
  kill(signal: NodeJS.Signals): void;
}

const isRunning = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

const stopRoot = async (child: ProcessTreeRoot) => {
  if (isRunning(child.pid)) {
    try {
      child.kill("SIGKILL");
    } catch (error) {
      if (isRunning(child.pid)) throw error;
    }
  }
  await child.exited;
};

export const stopWindowsProcessTree = async (child: ProcessTreeRoot, run = runTaskkill) => {
  let result: Awaited<ReturnType<typeof run>>;
  try {
    result = await run(child.pid);
  } finally {
    await stopRoot(child);
  }
  if (result.exitCode === 0) return;
  const refused = [...new Set([...result.output.matchAll(/PID (\d+)/gi)].map((match) => Number(match[1])))];
  const survivors = refused.filter(isRunning);
  if (survivors.length > 0)
    throw new Error(`Stopping the process tree left PIDs running: ${survivors.join(", ")}\n${result.output}`);
  // 128 means the root had already exited before taskkill found it.
  if (result.exitCode !== 128 && refused.length === 0)
    throw new Error(`taskkill failed for PID ${child.pid} with code ${result.exitCode}:\n${result.output}`);
};
