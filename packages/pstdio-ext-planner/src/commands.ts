import type { CommandDefinition } from "@pstdio/sdk/extensions";
import { metadataCommands } from "./commands/metadata-commands";
import { ticketCoreCommands } from "./commands/ticket-core-commands";
import { ticketLocalCommands } from "./commands/ticket-local-commands";
import { ticketReadCommands } from "./commands/ticket-read-commands";
import { ticketWorkspaceCommands } from "./commands/ticket-workspace-commands";

export const plannerCommands = {
  ...ticketCoreCommands,
  ...ticketLocalCommands,
  ...ticketReadCommands,
  ...ticketWorkspaceCommands,
  ...metadataCommands,
} satisfies Record<string, CommandDefinition>;
