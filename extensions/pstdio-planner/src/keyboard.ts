import { defineKeybinding } from "@pstdio/sdk/extensions";
import { createTicketCommand } from "./commands/create-ticket";
import { changeKeyboardStatus, keyboardStatusOptions } from "./commands/keyboard-status";
import { runAttemptCommand } from "./commands/run-attempt";
import { breakIntoSubTicketsCommand, refineTicketCommand } from "./commands/ticket-actions";
import { ticketsPageTarget } from "./data/ticket-page-target";
import { ticketResourceKind } from "./resource-kinds";
import { timelinePage } from "./timeline/pages";
export const plannerKeyboardCommands = [changeKeyboardStatus, keyboardStatusOptions];
export const plannerShortcuts = [
  defineKeybinding({ id: "go-tickets", layer: "go", key: "K", sticky: true, action: ticketsPageTarget }),
  defineKeybinding({
    id: "go-timeline",
    layer: "go",
    key: "T",
    sticky: true,
    action: { kind: "page", page: timelinePage.ref },
  }),
  defineKeybinding({
    id: "create-ticket",
    layer: "create",
    key: ticketResourceKind.ref.id[0]!.toUpperCase(),
    action: { kind: "command", target: { command: createTicketCommand.ref } },
  }),
  ...(
    [
      ["status", "S", changeKeyboardStatus],
      ["refine", "R", refineTicketCommand],
      ["implement", "I", runAttemptCommand],
      ["children", "B", breakIntoSubTicketsCommand],
    ] as const
  ).map(([id, key, command]) =>
    defineKeybinding({
      id: `current-${id}`,
      layer: "current",
      key,
      targetScope: "resource",
      when: { resourceType: [ticketResourceKind.ref] },
      action: { kind: "command", target: { command: command.ref } },
    }),
  ),
];
