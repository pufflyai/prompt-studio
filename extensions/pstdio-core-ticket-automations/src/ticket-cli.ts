import { type CommandContext, type CommandDefinition, type ParamObjectSchema, params } from "@pstdio/sdk/extensions";

type TicketCliParams = Record<string, unknown>;
type TicketCliContext = Pick<CommandContext<TicketCliParams>, "params" | "process" | "projectId" | "repo" | "repos">;

interface TicketCliFlag {
  flag?: string;
  positional?: true;
}

interface TicketCliCommandSpec {
  title: string;
  description: string;
  path: string[];
  params: ParamObjectSchema;
  flags: Record<string, TicketCliFlag>;
  includeProjectId?: boolean;
}

const ticketIdParam = params.text({ label: "Ticket", required: true });
const statusParam = params.text({ label: "Status", required: false });
const tagParam = params.json({ label: "Tags", required: false });
const parentParam = params.text({ label: "Parent ticket", required: false });

const appendFlag = (command: string[], flag: string, value: unknown) => {
  if (value === undefined || value === null || value === false) return;
  if (value === true) {
    command.push(`--${flag}`);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) command.push(`--${flag}`, String(item));
    return;
  }
  command.push(`--${flag}`, String(value));
};

const appendPosition = (command: string[], value: unknown) => {
  if (value === undefined || value === null || value === false || value === true) return;
  if (Array.isArray(value)) {
    command.push(...value.map(String));
    return;
  }
  command.push(String(value));
};

const ticketCliCwd = async (ctx: TicketCliContext) => ctx.repo?.path ?? (await ctx.repos.getDefault())?.path;

const runTicketCliCommand = async (ctx: TicketCliContext, spec: TicketCliCommandSpec) => {
  const command = ["pstdio", ...spec.path];

  if (spec.includeProjectId !== false) command.push("--project-id", ctx.projectId);

  for (const [paramName, config] of Object.entries(spec.flags)) {
    const value = ctx.params[paramName];
    if (config.positional) {
      appendPosition(command, value);
      continue;
    }
    appendFlag(command, config.flag ?? paramName, value);
  }

  const result = await ctx.process.runOrThrow({ command, cwd: await ticketCliCwd(ctx) });
  return {
    command,
    stderr: result.stderr,
    stdout: result.stdout,
  };
};

const ticketCliCommand = (spec: TicketCliCommandSpec) =>
  ({
    title: spec.title,
    description: spec.description,
    cli: {
      path: spec.path,
      examples: [`pstdio pstdio-core-ticket-automations ${spec.path.join(" ")}`],
    },
    params: spec.params,
    async run(ctx) {
      return runTicketCliCommand(ctx, spec);
    },
  }) satisfies CommandDefinition<ParamObjectSchema>;

export const ticketCliCommands = {
  "tickets.write": ticketCliCommand({
    title: "Write draft ticket",
    description: "Create a draft ticket with a local file.",
    path: ["tickets", "write"],
    includeProjectId: false,
    params: {
      title: params.text({ label: "Title", required: true }),
      template: params.text({ label: "Template", required: false }),
      tag: tagParam,
      status: statusParam,
      userPrompt: params.longText({ label: "User prompt", required: false }),
      parentId: parentParam,
    },
    flags: {
      title: {},
      template: {},
      tag: {},
      status: {},
      userPrompt: { flag: "user-prompt" },
      parentId: { flag: "parent-id" },
    },
  }),
  "tickets.create": ticketCliCommand({
    title: "Create ticket",
    description: "Create a ticket directly in the database.",
    path: ["tickets", "create"],
    params: {
      content: params.longText({ label: "Content", required: true }),
      status: statusParam,
      parentId: parentParam,
      tag: tagParam,
    },
    flags: { content: {}, status: {}, parentId: { flag: "parent-id" }, tag: {} },
  }),
  "tickets.save": ticketCliCommand({
    title: "Save ticket",
    description: "Save local ticket content and files to the database.",
    path: ["tickets", "save"],
    includeProjectId: false,
    params: { id: ticketIdParam, status: statusParam, tag: tagParam },
    flags: { id: {}, status: {}, tag: {} },
  }),
  "tickets.list": ticketCliCommand({
    title: "List tickets",
    description: "List tickets.",
    path: ["tickets", "list"],
    params: {
      status: statusParam,
      tag: tagParam,
      archived: params.boolean({ label: "Archived", required: false }),
      draft: params.boolean({ label: "Draft", required: false }),
      parentId: parentParam,
    },
    flags: { status: {}, tag: {}, archived: {}, draft: {}, parentId: { flag: "parent-id" } },
  }),
  "tickets.update": ticketCliCommand({
    title: "Update ticket",
    description: "Update ticket status, tags, or parent.",
    path: ["tickets", "update"],
    params: {
      id: ticketIdParam,
      status: statusParam,
      parentId: parentParam,
      clearParent: params.boolean({ label: "Clear parent", required: false }),
      tag: tagParam,
    },
    flags: { id: {}, status: {}, parentId: { flag: "parent-id" }, clearParent: { flag: "no-parent-id" }, tag: {} },
  }),
  "tickets.view": ticketCliCommand({
    title: "View ticket",
    description: "View ticket details or a single ticket field.",
    path: ["tickets", "view"],
    params: {
      field: params.text({ label: "Field", required: false }),
      id: ticketIdParam,
    },
    flags: { field: { positional: true }, id: {} },
  }),
  "tickets.implement": ticketCliCommand({
    title: "Implement ticket",
    description: "Move ticket to wip and launch agent.",
    path: ["tickets", "implement"],
    params: { id: ticketIdParam },
    flags: { id: {} },
  }),
  "tickets.pull": ticketCliCommand({
    title: "Pull tickets",
    description: "Pull ticket content and files from the database.",
    path: ["tickets", "pull"],
    includeProjectId: false,
    params: {
      id: params.text({ label: "Ticket", required: false }),
      force: params.boolean({ label: "Force", required: false }),
    },
    flags: { id: {}, force: {} },
  }),
  "tickets.files": ticketCliCommand({
    title: "List ticket files",
    description: "List ticket files from database and local project.",
    path: ["tickets", "files"],
    params: { id: ticketIdParam },
    flags: { id: {} },
  }),
  "tickets.workspaces": ticketCliCommand({
    title: "List ticket workspaces",
    description: "List active workspaces linked to a ticket.",
    path: ["tickets", "workspaces"],
    params: {
      id: ticketIdParam,
      jsonOutput: params.boolean({ label: "JSON output", required: false }),
    },
    flags: { id: {}, jsonOutput: { flag: "json" } },
  }),
  "tickets.worktrees.list": ticketCliCommand({
    title: "List ticket worktrees",
    description: "List active worktrees linked to a ticket.",
    path: ["tickets", "worktrees", "list"],
    params: {
      id: ticketIdParam,
      jsonOutput: params.boolean({ label: "JSON output", required: false }),
    },
    flags: { id: {}, jsonOutput: { flag: "json" } },
  }),
  "tickets.worktrees.removeAll": ticketCliCommand({
    title: "Remove ticket worktrees",
    description: "Remove all worktrees for a ticket.",
    path: ["tickets", "worktrees", "remove-all"],
    params: { id: ticketIdParam },
    flags: { id: {} },
  }),
  "tickets.updateWhenAttemptStatus": ticketCliCommand({
    title: "Update ticket when attempts match",
    description: "Conditionally update ticket status when all attempts match a given attempt status.",
    path: ["tickets", "update-when-attempt-status"],
    params: {
      id: ticketIdParam,
      allAttemptsStatus: params.text({ label: "All attempts status", required: true }),
      setStatus: params.text({ label: "Set status", required: true }),
    },
    flags: { id: {}, allAttemptsStatus: { flag: "all-attempts-status" }, setStatus: { flag: "set-status" } },
  }),
  "tickets.delete": ticketCliCommand({
    title: "Delete ticket",
    description: "Delete a ticket.",
    path: ["tickets", "delete"],
    params: { id: ticketIdParam },
    flags: { id: {} },
  }),
  "tickets.archive": ticketCliCommand({
    title: "Archive ticket",
    description: "Archive a ticket.",
    path: ["tickets", "archive"],
    params: { id: ticketIdParam },
    flags: { id: {} },
  }),
} satisfies Record<string, CommandDefinition<ParamObjectSchema>>;
