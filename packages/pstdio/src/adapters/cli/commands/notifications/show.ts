import type { Argv } from "yargs";
import { showNotification as defaultShow } from "@/features/notifications/api/notifications-api";
import { resolveProjectId } from "@/features/projects/resolve-project-id";

type Deps = {
  showNotification: typeof defaultShow;
  log: (msg: string) => void;
  cwd: () => string;
};

const defaultDeps: Deps = {
  showNotification: defaultShow,
  log: console.log,
  cwd: () => process.cwd(),
};

interface Args {
  id: string;
  project?: string;
}

export const command = "show <id>";
export const describe = "Show a single notification";

export const builder = (yargs: Argv) =>
  yargs
    .positional("id", { type: "string", demandOption: true })
    .option("project", { type: "string", describe: "Project ID" });

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (args: Args) => {
    const { projectId } = resolveProjectId(deps.cwd(), args.project);
    const notification = await deps.showNotification(projectId, args.id);
    deps.log(JSON.stringify(notification, null, 2));
  };

export const handler = createHandler();
