import type { ListNotificationsQuery, NotificationStatus } from "@pstdio/sdk/api";
import type { Argv } from "yargs";
import { listNotifications as defaultListNotifications } from "@/features/notifications/api/notifications-api";
import { resolveProjectId } from "@/features/projects/resolve-project-id";

type Deps = {
  listNotifications: typeof defaultListNotifications;
  log: (msg: string) => void;
  cwd: () => string;
};

const defaultDeps: Deps = {
  listNotifications: defaultListNotifications,
  log: console.log,
  cwd: () => process.cwd(),
};

interface Args {
  project?: string;
  open?: boolean;
  snoozed?: boolean;
  done?: boolean;
  all?: boolean;
  priority?: string;
  source?: string;
  "resource-type"?: string;
  limit?: number;
}

export const command = "list";
export const describe = "List notifications for the current project";

export const builder = (yargs: Argv) =>
  yargs
    .option("project", { type: "string", describe: "Project ID (defaults to current repo project)" })
    .option("open", { type: "boolean", describe: "Show only open notifications (default)" })
    .option("snoozed", { type: "boolean", describe: "Show only snoozed notifications" })
    .option("done", { type: "boolean", describe: "Show only done notifications" })
    .option("all", { type: "boolean", describe: "Show all statuses" })
    .option("priority", { type: "string", describe: "Comma-separated priorities (low,normal,high,urgent)" })
    .option("source", { type: "string", describe: "Filter by source extension id" })
    .option("resource-type", { type: "string", describe: "Filter by target resource type" })
    .option("limit", { type: "number", describe: "Max items to return (default 50)" });

const resolveStatusFilter = (args: Args): NotificationStatus[] => {
  if (args.all) return ["open", "read", "snoozed", "done", "dismissed", "expired"];
  if (args.done) return ["done"];
  if (args.snoozed) return ["snoozed"];
  return ["open"];
};

const formatRow = (item: { id: string; title: string; kind: string; status: string; updatedAt: string }) =>
  `${item.id}  ${item.status.padEnd(8)} ${item.kind.padEnd(18)} ${item.updatedAt.slice(0, 19)}  ${item.title}`;

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (args: Args) => {
    const { projectId } = resolveProjectId(deps.cwd(), args.project);
    const query: ListNotificationsQuery = {
      status: resolveStatusFilter(args),
      priority: args.priority?.split(",").map((s) => s.trim()) as ListNotificationsQuery["priority"],
      sourceExtensionId: args.source,
      resourceType: args["resource-type"],
      limit: args.limit,
    };
    const { items } = await deps.listNotifications(projectId, query);
    if (items.length === 0) {
      deps.log("No notifications.");
      return;
    }
    deps.log(items.map(formatRow).join("\n"));
  };

export const handler = createHandler();
