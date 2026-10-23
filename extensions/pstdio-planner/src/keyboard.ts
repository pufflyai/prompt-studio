import { defineKeybinding } from "@pstdio/sdk/extensions";
import { changeKeyboardStatus, keyboardStatusOptions } from "./commands/keyboard-status";
import { newTicketCommand } from "./commands/new-ticket";
import { openTicketsCommand } from "./commands/open-tickets";
import { runAttemptCommand } from "./commands/run-attempt";
import { breakIntoSubTicketsCommand, refineTicketCommand } from "./commands/ticket-actions";
import { ticketResourceKind } from "./resource-kinds";
import { timelinePage } from "./timeline/pages";

export const plannerKeyboardCommands = [changeKeyboardStatus, keyboardStatusOptions];
export const plannerShortcuts = [
  defineKeybinding({
    id: "go-tickets",
    layer: "go",
    key: "P",
    sticky: true,
    action: { kind: "command", target: { command: openTicketsCommand.ref } },
  }),
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
    key: "P",
    action: { kind: "command", target: { command: newTicketCommand.ref } },
  }),
  defineKeybinding({
    id: "extension-open",
    layer: "extensions",
    key: "O",
    sticky: true,
    action: { kind: "command", target: { command: openTicketsCommand.ref } },
  }),
  defineKeybinding({
    id: "extension-timeline",
    layer: "extensions",
    key: "T",
    sticky: true,
    action: { kind: "page", page: timelinePage.ref },
  }),
  ...(
    [
      ["new", "N", newTicketCommand],
      ["refine", "R", refineTicketCommand],
      ["status", "S", changeKeyboardStatus],
      ["implement", "I", runAttemptCommand],
      ["children", "B", breakIntoSubTicketsCommand],
    ] as const
  ).map(([id, key, command]) =>
    defineKeybinding({
      id: `extension-${id}`,
      layer: "extensions",
      key,
      action: { kind: "command", target: { command: command.ref } },
    }),
  ),
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
