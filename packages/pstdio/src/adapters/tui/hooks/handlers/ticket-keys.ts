import type { InputKey, KeyboardDeps } from "./types";

export function handleTicketsInput(input: string, key: InputKey, deps: KeyboardDeps) {
  if (deps.ticketState.viewingTicket) {
    handleTicketContentInput(input, key, deps);
  } else {
    handleTicketListInput(input, key, deps);
  }
}

function handleTicketContentInput(input: string, key: InputKey, deps: KeyboardDeps) {
  const { ticketState } = deps;
  if (key.escape) {
    ticketState.setViewingTicket(null);
    return;
  }
  if (input === "e") {
    deps.setStatusPickerIndex(() => 0);
    deps.setMode((m) => ({ ...m, overlay: "status-picker" }));
    return;
  }
  if (input === "x" && ticketState.viewingTicket) {
    deps.onArchiveRequest(ticketState.viewingTicket);
    deps.setMode((m) => ({ ...m, overlay: "confirm-archive" }));
  }
}

function handleTicketListNav(input: string, key: InputKey, deps: KeyboardDeps) {
  if (key.downArrow) {
    deps.ticketMoveTo(deps.ticketSelectedIndex + 1);
    return true;
  }
  if (key.upArrow) {
    deps.ticketMoveTo(deps.ticketSelectedIndex - 1);
    return true;
  }
  if (input === "g") {
    deps.ticketMoveTo(0);
    return true;
  }
  if (input === "G") {
    deps.ticketMoveTo(deps.ticketRowCount - 1);
    return true;
  }
  if (key.return) {
    const row = deps.ticketState.flatRows[deps.ticketSelectedIndex];
    if (!row || row.type === "header") return true;
    if (row.hasChildren && !deps.ticketState.expanded.has(row.ticket.id)) {
      deps.ticketState.toggleExpand(row.ticket.id);
    } else {
      deps.ticketState.setViewingTicket(row.ticket);
    }
    return true;
  }
  return false;
}

function handleTicketListInput(input: string, key: InputKey, deps: KeyboardDeps) {
  const { ticketState } = deps;
  if (handleTicketListNav(input, key, deps)) return;

  if (input === "/") {
    deps.setMode((m) => ({ ...m, search: true }));
    deps.setInputValue("");
    return;
  }
  if (input === "n") {
    deps.setMode((m) => ({ ...m, overlay: "ticket-create", search: true }));
    deps.setInputValue("");
    return;
  }

  if (input === "e") {
    const row = ticketState.flatRows[deps.ticketSelectedIndex];
    if (row?.type === "ticket") {
      deps.setStatusPickerIndex(() => 0);
      deps.setMode((m) => ({ ...m, overlay: "status-picker" }));
    }
    return;
  }

  if (input === "x") {
    const row = ticketState.flatRows[deps.ticketSelectedIndex];
    if (row?.type === "ticket") {
      deps.onArchiveRequest(row.ticket);
      deps.setMode((m) => ({ ...m, overlay: "confirm-archive" }));
    }
  }
}
