import { useInput } from "ink";

import { handleDocsInput } from "./handlers/docs-keys";
import { handleOverlayInput } from "./handlers/overlay-keys";
import { handleTemplatesInput } from "./handlers/template-keys";
import { handleTicketsInput } from "./handlers/ticket-keys";
import type { InputKey, KeyboardDeps } from "./handlers/types";
import { TABS } from "./handlers/types";

export type { KeyboardDeps } from "./handlers/types";

function handleSearchInput(key: InputKey, deps: KeyboardDeps) {
  if (!key.escape) return false;
  if (deps.mode.tab === "tickets") {
    deps.ticketState.setSearchQuery("");
    deps.ticketResetSelection();
  } else {
    deps.setSearchQuery("");
    deps.docsResetSelection();
  }
  deps.setMode((m) => ({ ...m, search: undefined }));
  deps.setInputValue("");
  return true;
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

function handleCommonKeys(input: string, key: InputKey, deps: KeyboardDeps) {
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
  if (input === "S" || (input === "s" && key.shift)) {
    deps.onSettingsOpen();
    deps.setMode((m) => ({ ...m, overlay: "settings" }));
    return true;
  }
  return false;
}

export function useKeyboard(deps: KeyboardDeps) {
  useInput((input, key) => {
    if (deps.mode.overlay && handleOverlayInput(input, key, deps)) return;
    if (deps.mode.search) {
      if (handleSearchInput(key, deps)) return;
    }
    if (handleTabSwitch(input, key, deps)) return;
    if (handleCommonKeys(input, key, deps)) return;

    if (deps.mode.tab === "docs") handleDocsInput(input, key, deps);
    else if (deps.mode.tab === "tickets") handleTicketsInput(input, key, deps);
    else if (deps.mode.tab === "templates") handleTemplatesInput(input, key, deps);
  });
}
