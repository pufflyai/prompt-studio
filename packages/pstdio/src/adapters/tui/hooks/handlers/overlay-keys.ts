import { handleSettingsInput } from "./settings-keys";
import type { InputKey, KeyboardDeps } from "./types";
import { closeOverlay } from "./types";

export function handleOverlayInput(input: string, key: InputKey, deps: KeyboardDeps) {
  const { overlay } = deps.mode;
  if (overlay === "help") {
    if (input === "?" || key.escape) {
      closeOverlay(deps);
      return true;
    }
    // Close help and let global shortcuts pass through
    closeOverlay(deps);
    return false;
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
  if (overlay === "settings") {
    if (deps.settingsCreateStep === "name") {
      if (key.escape) {
        handleSettingsInput(input, key, deps);
        return true;
      }
      return false;
    }
    handleSettingsInput(input, key, deps);
    return true;
  }
  if (overlay === "confirm-archive") {
    if (key.return) {
      deps.onArchiveConfirm();
      closeOverlay(deps);
    } else if (key.escape) {
      closeOverlay(deps);
    }
    return true;
  }
  if (overlay === "ticket-create") {
    if (key.escape) {
      closeOverlay(deps);
      return true;
    }
    return false;
  }
  return false;
}

function handlePickerInput(_input: string, key: InputKey, deps: KeyboardDeps) {
  if (key.escape) {
    closeOverlay(deps);
    return;
  }
  if (key.downArrow) {
    deps.setPickerIndex((i) => Math.min(i + 1, deps.pickerCount - 1));
    return;
  }
  if (key.upArrow) {
    deps.setPickerIndex((i) => Math.max(i - 1, 0));
    return;
  }
  if (key.return && deps.pickerCount > 0) {
    deps.onPickerSelect();
    closeOverlay(deps);
  }
}

function handleAgentsInput(input: string, key: InputKey, deps: KeyboardDeps) {
  if (key.escape) {
    closeOverlay(deps);
    return;
  }
  if (key.downArrow) {
    deps.setAgentIndex((i) => Math.min(i + 1, deps.agentCount - 1));
    return;
  }
  if (key.upArrow) {
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

function handleStatusPickerInput(_input: string, key: InputKey, deps: KeyboardDeps) {
  if (key.escape) {
    closeOverlay(deps);
    return;
  }
  if (key.downArrow) {
    deps.setStatusPickerIndex((i) => Math.min(i + 1, deps.statusPickerCount - 1));
    return;
  }
  if (key.upArrow) {
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
