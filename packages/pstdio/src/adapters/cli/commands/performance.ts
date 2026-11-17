import { resolve } from "node:path";
import type { RenderCaptureOperation } from "pstdio-api-contracts/performance-diagnostics";
import { renderCaptureReplySchema } from "pstdio-api-contracts/performance-diagnostics";
import { readPerformanceRecordings } from "pstdio-diagnostics";
import { resolvePstdioPerformanceEndpoint } from "pstdio-paths";
import type { Argv } from "yargs";
import { requestPerformanceEndpoint } from "@/features/performance";

export const command = "performance [action] [directory]";
export const describe = "Read local performance, React render captures, or saved recordings";

export const builder = (yargs: Argv) =>
  yargs
    .positional("action", {
      choices: ["snapshot", "renders", "recordings"] as const,
      default: "snapshot",
      describe: "Evidence to read",
    })
    .option("start", {
      type: "boolean",
      describe: "Start a ten-second local React render capture with the renders action",
    })
    .positional("directory", { type: "string", describe: "Saved recording directory shown by the Performance export" });

interface PerformanceArgs {
  action?: string;
  directory?: string;
  start?: boolean;
}

type Deps = {
  log: (message: string) => void;
  resolveEndpoint: () => string;
};

const defaultDeps: Deps = {
  log: console.log,
  resolveEndpoint: () => resolvePstdioPerformanceEndpoint(),
};

// Another local program could own the endpoint path, so print only what looks
// like the desktop app's snapshot.
const isDesktopSnapshot = (value: unknown) =>
  typeof value === "object" &&
  value !== null &&
  "version" in value &&
  (value.version === 1 ||
    (value.version === 2 &&
      "capture" in value &&
      typeof value.capture === "object" &&
      value.capture !== null &&
      "version" in value.capture &&
      value.capture.version === 2)) &&
  "host" in value &&
  value.host === "desktop" &&
  "processes" in value &&
  Array.isArray(value.processes);

const requireLocalEndpoint = async (deps: Deps, operation?: RenderCaptureOperation) => {
  const response = await requestPerformanceEndpoint(deps.resolveEndpoint(), operation);
  if (!response) {
    throw new Error(
      "Performance monitoring is not running on this device. Turn it on in Prompt Studio desktop under Settings → Developer tools.",
    );
  }
  return response;
};

const readRenders = async (deps: Deps, start: boolean | undefined) => {
  const reply = renderCaptureReplySchema.parse(await requireLocalEndpoint(deps, start ? "start-renders" : "renders"));
  if ("error" in reply) throw new Error(reply.error);
  if (!reply.capture) throw new Error("Start a React render capture with pst performance renders --start.");
  return reply.capture;
};

// Device reads never call a project runtime.
export const createHandler =
  (deps: Partial<Deps> = {}) =>
  async (args: PerformanceArgs = {}) => {
    const resolvedDeps = { ...defaultDeps, ...deps };
    if (args.start && args.action !== "renders") throw new Error("Use --start with performance renders.");
    if (args.action === "recordings") {
      if (!args.directory) throw new Error("Pass the saved performance recording directory.");
      resolvedDeps.log(JSON.stringify(readPerformanceRecordings(resolve(args.directory)), null, 2));
      return;
    }
    if (args.action === "renders") {
      resolvedDeps.log(JSON.stringify(await readRenders(resolvedDeps, args.start), null, 2));
      return;
    }
    const snapshot = await requireLocalEndpoint(resolvedDeps);
    if (!isDesktopSnapshot(snapshot)) throw new Error("The performance endpoint returned an unexpected response.");
    resolvedDeps.log(JSON.stringify(snapshot, null, 2));
  };

export const handler = createHandler();
