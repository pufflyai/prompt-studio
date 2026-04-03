import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { resolveProjectId as defaultResolveProjectId } from "@/features/projects/resolve-project-id";
import { listAttemptStatuses as defaultListAttemptStatuses } from "@/features/workspaces/api/list-attempt-statuses";

export const command = "list-statuses";
export const describe = "List available attempt statuses";

export const builder = (yargs: Argv) =>
  yargs.option("project-id", { type: "string", describe: "Project ID" }).option("json", {
    type: "boolean",
    describe: "Output as JSON",
  });

type ListStatusesArgs = {
  "project-id"?: string;
  json?: boolean;
};

type Deps = {
  cwd: () => string;
  resolveProjectId: typeof defaultResolveProjectId;
  listAttemptStatuses: typeof defaultListAttemptStatuses;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  resolveProjectId: defaultResolveProjectId,
  listAttemptStatuses: defaultListAttemptStatuses,
  log: console.log,
};

type TableRow = {
  name: string;
  color: string;
  isDefault: string;
};

const formatTable = (rows: TableRow[]) => {
  const header: TableRow = { name: "Name", color: "Color", isDefault: "Default" };

  const widths = {
    name: Math.max(header.name.length, ...rows.map((row) => row.name.length)),
    color: Math.max(header.color.length, ...rows.map((row) => row.color.length)),
  };

  const pad = (value: string, width: number) => value.padEnd(width);
  const line = (row: TableRow) => `${pad(row.name, widths.name)}   ${pad(row.color, widths.color)}   ${row.isDefault}`;
  return [line(header), ...rows.map(line)].join("\n");
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ListStatusesArgs>) => {
    const { projectId } = deps.resolveProjectId(deps.cwd(), argv["project-id"]);
    const statuses = await deps.listAttemptStatuses(API_URL, projectId);

    if (statuses.length === 0) {
      deps.log("No attempt statuses found.");
      return;
    }

    if (argv.json) {
      deps.log(JSON.stringify(statuses, null, 2));
      return;
    }

    const rows = statuses.map((status) => ({
      name: status.name,
      color: status.color,
      isDefault: status.is_default ? "*" : "",
    }));

    deps.log(formatTable(rows));
  };

export const handler = createHandler();
