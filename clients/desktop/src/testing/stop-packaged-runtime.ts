export const stopPackagedRuntime = async (pid: number) => {
  try {
    process.kill(pid, "SIGKILL");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    return;
  }

  // Termination is asynchronous on Windows; wait before removing the runtime's home.
  while (true) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};
