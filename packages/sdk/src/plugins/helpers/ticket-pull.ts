import type { PluginHelperContext } from "./context";
import { executePlannerCommand } from "./planner";

type TicketPullRef = {
  ticketId?: string;
};

type PullTicketsInput = TicketPullRef & {
  rootPath: string;
  force?: boolean;
  log?: (message: string) => void;
};

type PullTicketsResult = {
  pulledTicketShorthands: string[];
  downloadedFileCount: number;
};

type PullTicketsCommandResult = {
  pulledTicketShorthands?: string[];
  pulled_ticket_shorthands?: string[];
  downloadedFileCount?: number;
  downloaded_file_count?: number;
  messages?: string[];
};

export const pullTickets = async (ctx: PluginHelperContext, input: PullTicketsInput): Promise<PullTicketsResult> => {
  const result = (await executePlannerCommand(ctx, "pstdio.planner.pullTickets", {
    ticket_id: input.ticketId,
    repo_path: input.rootPath,
    force: input.force ?? false,
  })) as PullTicketsCommandResult;

  const log = input.log ?? (() => {});
  for (const message of result.messages ?? []) log(message);

  return {
    pulledTicketShorthands: result.pulled_ticket_shorthands ?? result.pulledTicketShorthands ?? [],
    downloadedFileCount: result.downloaded_file_count ?? result.downloadedFileCount ?? 0,
  };
};

export type { PullTicketsInput, PullTicketsResult };
