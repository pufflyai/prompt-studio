import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";
import { resolveProjectId } from "@/features/projects/resolve-project-id";

export const command = "execution <action> <instance>";
export const describe = "Inspect, stop or restart extension execution while keeping saved data";
export const builder = (yargs: Argv) =>
  yargs
    .positional("action", { choices: ["status", "stop", "restart"] as const, demandOption: true })
    .positional("instance", { type: "string", demandOption: true, describe: "Extension instance ID" })
    .option("project-id", { type: "string", describe: "Project ID" })
    .option("shared", { type: "boolean", describe: "Apply to every project listed by execution status" });

interface Args {
  action: "status" | "stop" | "restart";
  instance: string;
  "project-id"?: string;
  shared?: boolean;
}

interface Deps {
  execution: () => ReturnType<typeof apiClient>["extensions"]["execution"];
  log: (message: string) => void;
  warn: (message: string) => void;
}
const defaults: Deps = { execution: () => apiClient().extensions.execution, log: console.log, warn: console.error };

export const createHandler =
  (deps: Deps = defaults) =>
  async (argv: Arguments<Args>) => {
    const { projectId } = resolveProjectId(process.cwd(), argv["project-id"]);
    const execution = deps.execution();
    const status = await execution.get(projectId, argv.instance);
    if (argv.action === "status") {
      deps.log(JSON.stringify(status, null, 2));
      return;
    }
    if (!status.available) throw new Error("Execution controls are unavailable on this runtime.");
    deps.warn(`Affected projects: ${status.affectedProjects.map((project) => project.name).join(", ") || "none"}.`);
    deps.warn(
      "Running calls sharing this source will end. Accepted effects and saved data are retained; failed commands are not replayed.",
    );
    if (status.affectedProjects.length > 1 && !argv.shared)
      throw new Error("Inspect execution status, then pass --shared to apply to every reported project.");
    const result = await execution[argv.action](projectId, argv.instance);
    deps.log(JSON.stringify(result, null, 2));
  };
export const handler = createHandler();
