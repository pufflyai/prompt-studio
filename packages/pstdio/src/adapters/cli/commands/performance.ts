import { resolve } from "node:path";
import { readPerformanceRecordings } from "pstdio-diagnostics";
import { resolvePstdioPerformanceEndpoint } from "pstdio-paths";
import type { Argv } from "yargs";
import { readPerformanceEndpoint } from "@/features/performance";

export const command = "performance [action] [directory]";
export const describe = "Read the local performance snapshot or export saved recordings";

export const builder = (yargs: Argv) =>
  yargs
    .positional("action", {
      choices: ["snapshot", "recordings"] as const,
      default: "snapshot",
      describe: "Evidence to read",
    })
    .positional("directory", { type: "string", describe: "Saved recording directory shown by the Performance export" });

interface PerformanceArgs {
  action?: string;
  directory?: string;
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

// Reads the same snapshot a person sees in the Performance view. It talks to the
// desktop app on this device directly and never sends measurements to a runtime.
export const createHandler =
  (deps: Partial<Deps> = {}) =>
  async (args: PerformanceArgs = {}) => {
    const resolvedDeps = { ...defaultDeps, ...deps };
    if (args.action === "recordings") {
      if (!args.directory) throw new Error("Pass the saved performance recording directory.");
      resolvedDeps.log(JSON.stringify(readPerformanceRecordings(resolve(args.directory)), null, 2));
      return;
    }
    const snapshot = await readPerformanceEndpoint(resolvedDeps.resolveEndpoint());
    if (!snapshot) {
      throw new Error(
        "Performance monitoring is not running on this device. Turn it on in Prompt Studio desktop under Settings → Developer tools.",
      );
    }
    if (!isDesktopSnapshot(snapshot)) throw new Error("The performance endpoint returned an unexpected response.");
    resolvedDeps.log(JSON.stringify(snapshot, null, 2));
  };

export const handler = createHandler();
