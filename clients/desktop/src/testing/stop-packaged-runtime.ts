import { isRuntimePidAlive } from "pstdio/runtime";

export const stopPackagedRuntime = async (pid: number) => {
  try {
    process.kill(pid, "SIGKILL");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    return;
  }

  // Termination is asynchronous on Windows; wait before removing the runtime's home.
  while (isRuntimePidAlive(pid)) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};
