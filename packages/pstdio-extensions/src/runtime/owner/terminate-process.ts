export const terminateOwnerProcess = async (child: Bun.Subprocess) => {
  if (process.platform === "win32") {
    if (child.exitCode === null) {
      const kill = Bun.spawn(["taskkill", "/pid", String(child.pid), "/T", "/F"], {
        stdout: "ignore",
        stderr: "ignore",
      });
      await kill.exited;
    }
  } else {
    try {
      // A process group can retain children after its leader has already exited.
      process.kill(-child.pid, "SIGKILL");
    } catch {
      if (child.exitCode === null) child.kill("SIGKILL");
    }
  }
  await child.exited;
};
