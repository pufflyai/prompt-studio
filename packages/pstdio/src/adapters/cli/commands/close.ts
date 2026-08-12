import { resolvePstdioRuntimeDescriptorPath } from "pstdio-paths";
import type { Argv } from "yargs";
import { requestRuntimeShutdown, waitForRuntimeExit } from "@/features/runtime/runtime-client";
import { discoverRuntime } from "@/features/runtime/runtime-descriptor";

export const command = "close";
export const describe = "Gracefully stop the shared pstdio runtime";

export const builder = (yargs: Argv) =>
  yargs.option("force", {
    type: "boolean",
    default: false,
    describe: "Cancel active work before graceful shutdown",
  });

type CloseDeps = {
  discoverRuntime: typeof discoverRuntime;
  requestShutdown: typeof requestRuntimeShutdown;
  resolveDescriptorPath: typeof resolvePstdioRuntimeDescriptorPath;
  waitForExit: typeof waitForRuntimeExit;
  log: (message: string) => void;
  error: (message: string) => void;
  setExitCode: (code: number) => void;
};

const defaultDeps: CloseDeps = {
  discoverRuntime,
  requestShutdown: requestRuntimeShutdown,
  resolveDescriptorPath: resolvePstdioRuntimeDescriptorPath,
  waitForExit: waitForRuntimeExit,
  log: (message) => process.stdout.write(`${message}\n`),
  error: (message) => process.stderr.write(`${message}\n`),
  setExitCode: (code) => {
    process.exitCode = code;
  },
};

const activityLines = (activity: {
  sessions: Array<{ id: string; label: string }>;
  terminals: Array<{ id: string; label: string }>;
  jobs: Array<{ id: string; label: string }>;
}) => [
  ...activity.sessions.map((item) => `Session: ${item.label} (${item.id})`),
  ...activity.terminals.map((item) => `Terminal: ${item.label} (${item.id})`),
  ...activity.jobs.map((item) => `Runtime job: ${item.label} (${item.id})`),
];

export const createHandler =
  (deps: CloseDeps = defaultDeps) =>
  async (args: { force: boolean }) => {
    const descriptorPath = deps.resolveDescriptorPath();
    const discovery = await deps.discoverRuntime(descriptorPath);
    if (discovery.state === "missing") {
      deps.log("Runtime is not running.");
      return;
    }
    if (discovery.state === "unsafe") {
      throw new Error(`Runtime descriptor cannot be safely reclaimed (${discovery.reason}).`);
    }

    const result = await deps.requestShutdown(discovery.descriptor, args.force);
    if (result.state === "active") {
      deps.error(
        ["Runtime has active work:", ...activityLines(result.activity), "Run `pst close --force` to cancel it."].join(
          "\n",
        ),
      );
      deps.setExitCode(1);
      return;
    }
    if (result.state === "failed") {
      throw new Error("Runtime did not accept the graceful shutdown request.");
    }

    await deps.waitForExit(descriptorPath, discovery.descriptor);
    deps.log("Runtime stopped.");
  };

export const handler = createHandler();
