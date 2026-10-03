import { resolvePstdioPerformanceEndpoint } from "pstdio-paths";
import { readPerformanceEndpoint } from "@/features/performance";

export const command = "performance";
export const describe = "Print the local performance snapshot from Prompt Studio desktop";

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
  value.version === 1 &&
  "host" in value &&
  value.host === "desktop" &&
  "processes" in value &&
  Array.isArray(value.processes);

// Reads the same snapshot a person sees in the Performance view. It talks to the
// desktop app on this device directly and never sends measurements to a runtime.
export const createHandler =
  (deps: Partial<Deps> = {}) =>
  async () => {
    const resolvedDeps = { ...defaultDeps, ...deps };
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
