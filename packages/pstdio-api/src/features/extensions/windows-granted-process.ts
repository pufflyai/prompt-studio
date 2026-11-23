import { dirname } from "node:path";
import { isPackagedRuntime } from "pstdio-paths";
import { apiLogger } from "../../lib/logger";
import type { ResolvedProcessCommand } from "./process-command";
import { exitedWithin } from "./process-group";
import { createWindowsProcessJob } from "./windows-process-job";

// This entry point stays idle until the host assigns it to the job and sends the command.
const launcherSource = `
  let launched = false;
  process.once("disconnect", () => {
    if (!launched) process.exit(1);
  });
  process.once("message", async ({ argv, cwd, env, detached, stdin, windowsVerbatimArguments }) => {
    launched = true;
    let child;
    try {
      child = Bun.spawn(argv, {
        cwd, env, detached, windowsVerbatimArguments, windowsHide: true,
        stdin: stdin === "pipe" ? "inherit" : "ignore",
        stdout: detached ? "ignore" : "inherit", stderr: detached ? "ignore" : "inherit",
      });
    } catch (error) {
      let commandMissing = false;
      if (error?.code === "ENOENT") {
        try {
          commandMissing = require("node:fs").statSync(cwd).isDirectory();
        } catch {}
      }
      // Only the classification crosses IPC. Raw spawn errors can contain command details.
      process.send({ commandMissing }, () => process.exit(1));
      return;
    }
    await new Promise((resolve, reject) => process.send({ pid: child.pid }, (error) => error ? reject(error) : resolve()));
    const exitCode = await child.exited;
    process.send({ exitCode }, () => process.exit(0));
  });
`;

type StartInput = {
  spawner: typeof Bun.spawn;
  command: ResolvedProcessCommand;
  cwd?: string;
  env: NodeJS.ProcessEnv;
  detached: boolean;
  stdin?: "pipe";
  stopTimeoutMs: number;
};

type JobExit = Pick<ReturnType<typeof createWindowsProcessJob>, "hasProcesses" | "close">;

const pollJob = async (job: JobExit) => {
  while (job.hasProcesses()) await new Promise((resolve) => setTimeout(resolve, 250).unref());
  job.close();
};

/** Keep the lifetime pending on an accounting error and let a later stop request a fresh check. */
export const watchJobExit = (job: JobExit, launcherExited: Promise<unknown>, onFailure: (error: unknown) => void) => {
  const verified = Promise.withResolvers<void>();
  let checking: Promise<void> | undefined;
  const check = () => {
    if (!checking) {
      checking = launcherExited.then(() => pollJob(job));
      void checking.then(verified.resolve, (error: unknown) => {
        checking = undefined;
        onFailure(error);
      });
    }
    return checking;
  };
  void check();
  return { treeExited: verified.promise, check };
};

/**
 * Bun cannot attach a job at process creation. Assign a trusted, idle Bun launcher to the job
 * first, then admit the requested program. Windows puts its ordinary descendants in the same job.
 */
export const startWindowsGrantedProcess = (input: StartInput) => {
  const job = createWindowsProcessJob();
  const started = Promise.withResolvers<number>();
  const reportedExit = Promise.withResolvers<number | undefined>();
  started.promise.catch(() => {});
  const output = input.detached ? "ignore" : "pipe";
  const launchError = (commandMissing = false) => {
    const error = new Error("The Windows process could not start.");
    return commandMissing ? Object.assign(error, { code: "ENOENT" }) : error;
  };
  let child: ReturnType<typeof Bun.spawn> | undefined;
  try {
    child = input.spawner([process.execPath, "--no-env-file", "-e", launcherSource], {
      cwd: dirname(process.execPath),
      env: {
        SystemRoot: process.env.SystemRoot,
        ...(isPackagedRuntime() ? { BUN_BE_BUN: "1" } : {}),
      },
      stdin: input.stdin ?? "ignore",
      stdout: output,
      stderr: output,
      windowsHide: true,
      detached: input.detached,
      ipc: (message, launcher) => {
        if (message && typeof message.pid === "number") {
          started.resolve(message.pid);
          return;
        }
        if (message && typeof message.exitCode === "number") reportedExit.resolve(message.exitCode);
        else started.reject(launchError(message?.commandMissing === true));
        launcher.disconnect();
      },
      onDisconnect: () => {
        started.reject(launchError());
        reportedExit.resolve(undefined);
      },
    });
    job.attachLauncher(child.pid);
    child.send({
      argv: input.command.argv,
      cwd: input.cwd ?? process.cwd(),
      windowsVerbatimArguments: input.command.windowsVerbatimArguments,
      env: input.env,
      detached: input.detached,
      stdin: input.stdin,
    });
  } catch (error) {
    // An unassigned launcher is waiting and has not received the command.
    try {
      child?.kill();
    } finally {
      job.close();
    }
    throw error;
  }

  let terminationRequested = false;
  // The launcher reports natural status over IPC. Job termination uses launcher code 1, which
  // a program can also exit with before the remaining members of its job are stopped.
  const completion = Promise.all([started.promise, child.exited, reportedExit.promise]).then(
    ([, launcherCode, reportedCode]) => ({
      code: reportedCode ?? launcherCode,
      terminated: reportedCode === undefined && terminationRequested && launcherCode === 1,
    }),
  );
  const exited = completion.then(({ code }) => code);
  const jobTerminated = completion.then(({ terminated }) => terminated, () => false);
  exited.catch(() => {});
  const { treeExited, check } = watchJobExit(job, child.exited, (error) => {
    apiLogger.warn(
      { err: error, event: "extension.process.job_tracking_failed" },
      "Could not verify Windows process job exit",
    );
  });
  return {
    child,
    pid: started.promise,
    exited,
    jobTerminated,
    treeExited,
    async stop() {
      if (job.hasProcesses()) {
        job.terminate();
        terminationRequested = true;
      }
      if (!(await exitedWithin(check(), input.stopTimeoutMs)))
        throw new Error("The Windows process job did not exit after it was stopped.");
    },
  };
};
