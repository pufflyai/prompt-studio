import type { Argv } from "yargs";
import {
  dismissNotification as defaultDismiss,
  doneNotification as defaultDone,
  readNotification as defaultRead,
  snoozeNotification as defaultSnooze,
} from "@/features/notifications/api/notifications-api";
import { resolveSnoozeUntil } from "@/features/notifications/cli/parse-snooze";
import { resolveProjectId } from "@/features/projects/resolve-project-id";

type Deps = {
  read: typeof defaultRead;
  done: typeof defaultDone;
  dismiss: typeof defaultDismiss;
  snooze: typeof defaultSnooze;
  log: (msg: string) => void;
  cwd: () => string;
};

const defaultDeps: Deps = {
  read: defaultRead,
  done: defaultDone,
  dismiss: defaultDismiss,
  snooze: defaultSnooze,
  log: console.log,
  cwd: () => process.cwd(),
};

interface BaseArgs {
  id: string;
  project?: string;
}

interface SnoozeArgs extends BaseArgs {
  until: string;
}

const builderBase = (yargs: Argv) =>
  yargs
    .positional("id", { type: "string", demandOption: true })
    .option("project", { type: "string", describe: "Project ID" });

export const readCommand = {
  command: "read <id>",
  describe: "Mark a notification as read",
  builder: builderBase,
  createHandler:
    (deps: Deps = defaultDeps) =>
    async (args: BaseArgs) => {
      const { projectId } = resolveProjectId(deps.cwd(), args.project);
      const out = await deps.read(projectId, args.id);
      deps.log(out.id);
    },
  get handler() {
    return this.createHandler();
  },
};

export const doneCommand = {
  command: "done <id>",
  describe: "Mark a notification as done",
  builder: builderBase,
  createHandler:
    (deps: Deps = defaultDeps) =>
    async (args: BaseArgs) => {
      const { projectId } = resolveProjectId(deps.cwd(), args.project);
      const out = await deps.done(projectId, args.id);
      deps.log(out.id);
    },
  get handler() {
    return this.createHandler();
  },
};

export const dismissCommand = {
  command: "dismiss <id>",
  describe: "Dismiss a notification",
  builder: builderBase,
  createHandler:
    (deps: Deps = defaultDeps) =>
    async (args: BaseArgs) => {
      const { projectId } = resolveProjectId(deps.cwd(), args.project);
      const out = await deps.dismiss(projectId, args.id);
      deps.log(out.id);
    },
  get handler() {
    return this.createHandler();
  },
};

export const snoozeCommand = {
  command: "snooze <id>",
  describe: "Snooze a notification (--until 1h or ISO8601)",
  builder: (yargs: Argv) => builderBase(yargs).option("until", { type: "string", demandOption: true }),
  createHandler:
    (deps: Deps = defaultDeps) =>
    async (args: SnoozeArgs) => {
      const { projectId } = resolveProjectId(deps.cwd(), args.project);
      const until = resolveSnoozeUntil(args.until);
      const out = await deps.snooze(projectId, args.id, until);
      deps.log(out.id);
    },
  get handler() {
    return this.createHandler();
  },
};
