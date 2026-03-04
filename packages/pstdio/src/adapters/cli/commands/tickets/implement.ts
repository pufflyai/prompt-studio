import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { listTicketStatuses as defaultListTicketStatuses } from "@/features/tickets/api/list-ticket-statuses";
import { listTickets as defaultListTickets } from "@/features/tickets/api/list-tickets";
import { updateTicket as defaultUpdateTicket } from "@/features/tickets/api/update-ticket";
import { readTicketFile } from "@/features/tickets/local-ticket";

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
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  listTickets: typeof defaultListTickets;
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
  findGitRoot,
  readConfig,
  listTickets: defaultListTickets,
  updateTicket: defaultUpdateTicket,
  listTicketStatuses: defaultListTicketStatuses,
  launchAgent: defaultLaunchAgent,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ImplementArgs>) => {
    let projectId = argv["project-id"];
    const root = deps.findGitRoot(deps.cwd());

    if (!projectId) {
      if (!root) throw new Error("No project specified. Provide --project-id or run inside a linked project.");
      const config = deps.readConfig(root);
      if (!config) throw new Error("No project specified. Provide --project-id or run inside a linked project.");
      projectId = config.project_id;
    }

    const tickets = await deps.listTickets(API_URL, {
      project_id: projectId,
      shorthand: argv.id,
    });
    if (tickets.length === 0) {
      throw new Error(`Ticket not found: ${argv.id}`);
    }

    const ticket = tickets[0];

    const statuses = await deps.listTicketStatuses(API_URL, projectId);
    const wipStatus = statuses.find((s) => s.name === "wip");
    if (wipStatus) {
      await deps.updateTicket(API_URL, ticket.id, { status_id: wipStatus.id });
    }

    deps.log(`Ticket ${argv.id} moved to wip`);

    const launchRoot = root ?? deps.cwd();
    const ticketContent = readTicketFile(launchRoot, argv.id);
    const prompt = ticketContent ?? `Implement ticket ${argv.id}`;

    deps.log("Launching agent...");

    await deps.launchAgent(argv.id, launchRoot, ticket.title, prompt);
  };

export const handler = createHandler();
