import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { resolveProjectId as defaultResolveProjectId } from "@/features/projects/resolve-project-id";
import { renderPrompt } from "@/features/prompts/render-prompt";
import { listTicketStatuses as defaultListTicketStatuses } from "@/features/tickets/api/list-ticket-statuses";
import { updateTicket as defaultUpdateTicket } from "@/features/tickets/api/update-ticket";
import { readTicketFile } from "@/features/tickets/local-ticket";
import { resolveTicketByShorthand as defaultResolveTicketByShorthand } from "@/features/tickets/resolve-ticket-by-shorthand";

export const command = "implement";
export const describe = "Move ticket to wip and launch agent";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", demandOption: true, describe: "Ticket shorthand" })
    .option("project-id", { type: "string", describe: "Project ID" });

type ImplementArgs = {
  id: string;
  "project-id"?: string;
};

type Deps = {
  cwd: () => string;
  resolveProjectId: typeof defaultResolveProjectId;
  resolveTicketByShorthand: typeof defaultResolveTicketByShorthand;
  updateTicket: typeof defaultUpdateTicket;
  listTicketStatuses: typeof defaultListTicketStatuses;
  launchAgent: (ticketId: string, root: string, title: string | null, prompt: string) => Promise<void>;
  log: (msg: string) => void;
};

const defaultLaunchAgent = async (ticketId: string, root: string, title: string | null, prompt: string) => {
  const { implement, createAgentRegistry, createClaudeCodeAgent, createOpencodeAgent } = await import("pstdio-agents");

  const registry = createAgentRegistry([createClaudeCodeAgent(), createOpencodeAgent()]);
  const agents = registry.list();
  const agent = agents[0];

  if (!agent) throw new Error("No agent configured. Run 'pstdio agents setup' first.");

  await implement(agent, ticketId, root, { title: title ?? undefined, prompt });
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  resolveProjectId: defaultResolveProjectId,
  resolveTicketByShorthand: defaultResolveTicketByShorthand,
  updateTicket: defaultUpdateTicket,
  listTicketStatuses: defaultListTicketStatuses,
  launchAgent: defaultLaunchAgent,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ImplementArgs>) => {
    const { projectId, root } = deps.resolveProjectId(deps.cwd(), argv["project-id"]);

    const ticket = await deps.resolveTicketByShorthand(API_URL, projectId, argv.id);
    if (!ticket) throw new Error(`Ticket not found: ${argv.id}`);

    const statuses = await deps.listTicketStatuses(API_URL, projectId);
    const wipStatus = statuses.find((s) => s.name === "wip");
    if (wipStatus) {
      await deps.updateTicket(API_URL, ticket.id, { status_id: wipStatus.id });
    }

    deps.log(`Ticket ${argv.id} moved to wip`);

    const launchRoot = root ?? deps.cwd();
    const ticketContent = readTicketFile(launchRoot, argv.id);
    const prompt = ticketContent ?? renderPrompt("implement-ticket", { ticket_id: argv.id });

    deps.log("Launching agent...");

    await deps.launchAgent(argv.id, launchRoot, ticket.display_title, prompt);
  };

export const handler = createHandler();
