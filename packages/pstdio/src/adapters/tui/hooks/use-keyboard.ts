import { useInput } from "ink";

import type { Mode, Tab } from "../app";
import type { useTemplates } from "./use-templates";
import type { useTickets } from "./use-tickets";

const TABS: Tab[] = ["tickets", "docs", "templates"];

export interface KeyboardDeps {
  mode: Mode;
  setMode: (mode: Mode | ((m: Mode) => Mode)) => void;
  exit: () => void;
  // docs
  docsSelectedIndex: number;
  docsRowCount: number;
  docsMoveTo: (index: number) => void;
  docsResetSelection: () => void;
  toggleExpand: () => void;
  openDocument: () => void;
  setInputValue: (value: string) => void;
  setSearchQuery: (query: string) => void;
  // tickets
  ticketSelectedIndex: number;
  ticketRowCount: number;
  ticketMoveTo: (index: number) => void;
  ticketResetSelection: () => void;
  ticketState: ReturnType<typeof useTickets>;
  // templates
  templateSelectedIndex: number;
  templateRowCount: number;
  templateMoveTo: (index: number) => void;
  templateState: ReturnType<typeof useTemplates>;
  // project picker
  pickerCount: number;
  setPickerIndex: (fn: (i: number) => number) => void;
  onPickerSelect: () => void;
  onPickerOpen: () => void;
  // agent manager
  agentCount: number;
  setAgentIndex: (fn: (i: number) => number) => void;
  onAgentOpen: () => void;
  onAgentSetup: () => void;
  onAgentRemove: () => void;
  onAgentSetDefault: () => void;
  // status picker
  statusPickerCount: number;
  statusPickerIndex: number;
  setStatusPickerIndex: (fn: (i: number) => number) => void;
}

type InputKey = {
  escape: boolean;
  downArrow: boolean;
  upArrow: boolean;
  return: boolean;
  tab: boolean;
  shift: boolean;
};

const closeOverlay = (deps: KeyboardDeps) => deps.setMode((m) => ({ ...m, overlay: undefined }));

function handleOverlayInput(input: string, key: InputKey, deps: KeyboardDeps) {
  const { overlay } = deps.mode;
  if (overlay === "help") {
    if (input === "?" || key.escape) closeOverlay(deps);
    return true;
  }
  if (overlay === "view") {
    if (key.escape) closeOverlay(deps);
    return true;
  }
  if (overlay === "projects") {
    handlePickerInput(input, key, deps);
    return true;
  }
  if (overlay === "agents") {
    handleAgentsInput(input, key, deps);
    return true;
  }
  if (overlay === "status-picker") {
    handleStatusPickerInput(input, key, deps);
    return true;
  }
  if (overlay === "ticket-create") {
    if (key.escape) closeOverlay(deps);
    return true;
  }
  return false;
}

function handleSearchInput(key: InputKey, deps: KeyboardDeps) {
  if (!key.escape) return;
  if (deps.mode.tab === "tickets") {
    deps.ticketState.setSearchQuery("");
    deps.ticketResetSelection();
  } else {
    deps.setSearchQuery("");
    deps.docsResetSelection();
  }
  deps.setMode((m) => ({ ...m, search: undefined }));
  deps.setInputValue("");
}

function handleTabSwitch(input: string, key: InputKey, deps: KeyboardDeps) {
  if (key.tab && !key.shift) {
    const idx = TABS.indexOf(deps.mode.tab);
    deps.setMode((m) => ({ ...m, tab: TABS[(idx + 1) % TABS.length]! }));
    return true;
  }
  if (key.tab && key.shift) {
    const idx = TABS.indexOf(deps.mode.tab);
    deps.setMode((m) => ({ ...m, tab: TABS[(idx - 1 + TABS.length) % TABS.length]! }));
    return true;
  }
  if (input === "1") {
    deps.setMode((m) => ({ ...m, tab: "tickets" }));
    return true;
  }
  if (input === "2") {
    deps.setMode((m) => ({ ...m, tab: "docs" }));
    return true;
  }
  if (input === "3") {
    deps.setMode((m) => ({ ...m, tab: "templates" }));
    return true;
  }
  return false;
}

function handleCommonKeys(input: string, deps: KeyboardDeps) {
  if (input === "q") {
    deps.exit();
    return true;
  }
  if (input === "?") {
    deps.setMode((m) => ({ ...m, overlay: "help" }));
    return true;
  }
  if (input === "p") {
    deps.onPickerOpen();
    deps.setMode((m) => ({ ...m, overlay: "projects" }));
    return true;
  }
  if (input === "a") {
    deps.onAgentOpen();
    deps.setMode((m) => ({ ...m, overlay: "agents" }));
    return true;
  }
  return false;
}

export function useKeyboard(deps: KeyboardDeps) {
  useInput((input, key) => {
    if (deps.mode.overlay && handleOverlayInput(input, key, deps)) return;
    if (deps.mode.search) {
      handleSearchInput(key, deps);
      return;
    }
    if (handleTabSwitch(input, key, deps)) return;
    if (handleCommonKeys(input, deps)) return;

    if (deps.mode.tab === "docs") handleDocsInput(input, key, deps);
    else if (deps.mode.tab === "tickets") handleTicketsInput(input, key, deps);
    else if (deps.mode.tab === "templates") handleTemplatesInput(input, key, deps);
  });
}

function handleDocsInput(
  input: string,
  key: { escape: boolean; downArrow: boolean; upArrow: boolean; return: boolean },
  deps: KeyboardDeps,
) {
  if (input === "j" || key.downArrow) {
    deps.docsMoveTo(deps.docsSelectedIndex + 1);
    return;
  }
  if (input === "k" || key.upArrow) {
    deps.docsMoveTo(deps.docsSelectedIndex - 1);
    return;
  }
  if (input === "g") {
    deps.docsMoveTo(0);
    return;
  }
  if (input === "G") {
    deps.docsMoveTo(deps.docsRowCount - 1);
    return;
  }
  if (key.return) {
    deps.toggleExpand();
    return;
  }
  if (input === "/") {
    deps.setMode((m) => ({ ...m, search: true }));
    deps.setInputValue("");
    return;
  }
}

function handleTicketsInput(
  input: string,
  key: { escape: boolean; downArrow: boolean; upArrow: boolean; return: boolean },
  deps: KeyboardDeps,
) {
  if (deps.ticketState.viewingTicket) {
    handleTicketContentInput(input, key, deps);
  } else {
    handleTicketListInput(input, key, deps);
  }
}

function handleTicketContentInput(input: string, key: { escape: boolean }, deps: KeyboardDeps) {
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
  if (input === "x" && ticketState.viewingTicket) ticketState.toggleArchive(ticketState.viewingTicket);
}

function handleTicketListNav(
  input: string,
  key: { downArrow: boolean; upArrow: boolean; return: boolean },
  deps: KeyboardDeps,
) {
  if (input === "j" || key.downArrow) {
    deps.ticketMoveTo(deps.ticketSelectedIndex + 1);
    return true;
  }
  if (input === "k" || key.upArrow) {
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

function handleTicketListInput(
  input: string,
  key: { escape: boolean; downArrow: boolean; upArrow: boolean; return: boolean },
  deps: KeyboardDeps,
) {
  const { ticketState } = deps;
  if (handleTicketListNav(input, key, deps)) return;

  if (input === "/") {
    deps.setMode((m) => ({ ...m, search: true }));
    deps.setInputValue("");
    return;
  }
  if (input === "s") {
    ticketState.cycleStatusFilter();
    deps.ticketResetSelection();
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
    if (row?.type === "ticket") ticketState.toggleArchive(row.ticket);
  }
}

function handleTemplatesInput(
  input: string,
  key: { escape: boolean; downArrow: boolean; upArrow: boolean; return: boolean },
  deps: KeyboardDeps,
) {
  const { templateState } = deps;

  // Content panel
  if (templateState.viewingTemplate) {
    if (key.escape) {
      templateState.closeTemplate();
      return;
    }
    if (input === "d") {
      templateState.setDefault(templateState.viewingTemplate.name);
      return;
    }
    return;
  }

  // List panel
  if (input === "j" || key.downArrow) {
    deps.templateMoveTo(deps.templateSelectedIndex + 1);
    return;
  }
  if (input === "k" || key.upArrow) {
    deps.templateMoveTo(deps.templateSelectedIndex - 1);
    return;
  }
  if (input === "g") {
    deps.templateMoveTo(0);
    return;
  }
  if (input === "G") {
    deps.templateMoveTo(deps.templateRowCount - 1);
    return;
  }

  if (key.return) {
    const item = templateState.items[deps.templateSelectedIndex];
    if (item) templateState.viewTemplate(item.name);
    return;
  }

  if (input === "d") {
    const item = templateState.items[deps.templateSelectedIndex];
    if (item) templateState.setDefault(item.name);
    return;
  }
}

function handlePickerInput(
  input: string,
  key: { escape: boolean; downArrow: boolean; upArrow: boolean; return: boolean },
  deps: KeyboardDeps,
) {
  if (key.escape) {
    closeOverlay(deps);
    return;
  }
  if (input === "j" || key.downArrow) {
    deps.setPickerIndex((i) => Math.min(i + 1, deps.pickerCount - 1));
    return;
  }
  if (input === "k" || key.upArrow) {
    deps.setPickerIndex((i) => Math.max(i - 1, 0));
    return;
  }
  if (key.return && deps.pickerCount > 0) {
    deps.onPickerSelect();
    closeOverlay(deps);
  }
}

function handleAgentsInput(
  input: string,
  key: { escape: boolean; downArrow: boolean; upArrow: boolean; return: boolean },
  deps: KeyboardDeps,
) {
  if (key.escape) {
    closeOverlay(deps);
    return;
  }
  if (input === "j" || key.downArrow) {
    deps.setAgentIndex((i) => Math.min(i + 1, deps.agentCount - 1));
    return;
  }
  if (input === "k" || key.upArrow) {
    deps.setAgentIndex((i) => Math.max(i - 1, 0));
    return;
  }
  if (input === "s") {
    deps.onAgentSetup();
    return;
  }
  if (input === "d") {
    deps.onAgentRemove();
    return;
  }
  if (key.return && deps.agentCount > 0) deps.onAgentSetDefault();
}

function handleStatusPickerInput(
  input: string,
  key: { escape: boolean; downArrow: boolean; upArrow: boolean; return: boolean },
  deps: KeyboardDeps,
) {
  if (key.escape) {
    closeOverlay(deps);
    return;
  }
  if (input === "j" || key.downArrow) {
    deps.setStatusPickerIndex((i) => Math.min(i + 1, deps.statusPickerCount - 1));
    return;
  }
  if (input === "k" || key.upArrow) {
    deps.setStatusPickerIndex((i) => Math.max(i - 1, 0));
    return;
  }

  if (key.return && deps.statusPickerCount > 0) {
    const { ticketState } = deps;
    const status = ticketState.statuses[deps.statusPickerIndex];
    const viewingTicket = ticketState.viewingTicket;
    const row = ticketState.flatRows[deps.ticketSelectedIndex];
    const ticketId = viewingTicket?.id ?? (row?.type === "ticket" ? row.ticket.id : null);

    if (status && ticketId) ticketState.updateTicketStatus(ticketId, status.id);
    closeOverlay(deps);
  }
}
