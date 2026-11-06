import type { ProjectFolderRecoveryStatus } from "pstdio-api-contracts";
import type { Argv } from "yargs";
import { apiClient } from "@/features/api-client";

export type FolderOperation = "download" | "restore";
export interface FolderCommandDeps {
  projects: () => Pick<
    ReturnType<typeof apiClient>["projects"],
    "folderRecovery" | "downloadFolder" | "restoreFolder" | "cancelFolderRecovery"
  >;
  cwd: () => string;
  /** Final results go to stdout as the same JSON the API returns. */
  log: (text: string) => void;
  /** Progress lines go to stderr, so stdout stays machine-readable. */
  progress: (text: string) => void;
  sleep: (ms: number) => Promise<void>;
  /** Runs `cancel` on Ctrl-C while waiting; returns a function that stops listening. */
  interrupted: (cancel: () => Promise<void>) => () => void;
  failed: () => void;
}

export const defaultFolderCommandDeps: FolderCommandDeps = {
  projects: () => apiClient().projects,
  cwd: () => process.cwd(),
  log: console.log,
  progress: (text) => process.stderr.write(`${text}\n`),
  sleep: (ms) => Bun.sleep(ms),
  interrupted: (cancel) => {
    const listener = () => void cancel();
    process.once("SIGINT", listener);
    return () => process.off("SIGINT", listener);
  },
  failed: () => {
    process.exitCode = 1;
  },
};

export const sourceOptions = (yargs: Argv) =>
  yargs
    .positional("id", { type: "string", demandOption: true, describe: "Project ID" })
    .option("device", { type: "string", demandOption: true, describe: "Device ID from projects folder sources" })
    .option("source", { type: "string", demandOption: true, describe: "Source ID from projects folder sources" })
    .option("wait", { type: "boolean", default: true, describe: "Wait and show progress until it finishes" });

const describeProgress = (operation: FolderOperation, status: ProjectFolderRecoveryStatus) => {
  const step = status[operation];
  const files =
    operation === "restore" ? ` ${status.restore.files.completed}/${status.restore.files.total ?? "?"} files,` : "";
  return `${operation}:${files} ${step.bytes.completed}/${step.bytes.total ?? "?"} bytes`;
};

/** Polls the same status the API and the project's sync status report, until the operation ends. */
export const waitForFolderOperation = async (
  deps: FolderCommandDeps,
  projectId: string,
  operation: FolderOperation,
  started: ProjectFolderRecoveryStatus,
) => {
  const projects = deps.projects();
  const stop = deps.interrupted(async () => {
    await projects.cancelFolderRecovery(projectId);
  });
  let status = started;
  try {
    while (status[operation].state === "running") {
      deps.progress(describeProgress(operation, status));
      await deps.sleep(500);
      status = await projects.folderRecovery(projectId);
    }
  } finally {
    stop();
  }
  deps.log(JSON.stringify(status, null, 2));
  if (status[operation].state !== "complete") {
    const error = status[operation].error;
    if (error) deps.progress(`${error.message}${error.path ? ` (${error.path})` : ""}`);
    deps.failed();
  }
  return status;
};
