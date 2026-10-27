/** Nested content may request UI entry, tab navigation and panel visibility, never arbitrary commands. */
export const WORKBENCH_KEYBOARD_OPEN_COMMAND_ID = "workbench.keyboard.open";
export const WORKBENCH_KEYBOARD_SELECT_TAB_COMMAND_ID = "workbench.keyboard.selectTab";

export const keyboardEntryKind = (commandId: string) => {
  if (commandId === WORKBENCH_KEYBOARD_OPEN_COMMAND_ID) return "mode" as const;
  if (
    commandId === "workbench.toggleSideBar" ||
    commandId === "workbench.toggleMainFullscreen" ||
    commandId === "workbench.keyboard.toggle.side" ||
    commandId === "workbench.keyboard.toggle.secondary"
  )
    return "panel" as const;
  if (
    commandId === WORKBENCH_KEYBOARD_SELECT_TAB_COMMAND_ID ||
    commandId === "workbench.keyboard.ArrowLeft" ||
    commandId === "workbench.keyboard.ArrowRight"
  )
    return "tab" as const;
  return undefined;
};
