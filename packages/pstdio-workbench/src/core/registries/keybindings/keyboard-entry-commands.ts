/** Nested content may request UI entry and exact tab navigation, never arbitrary commands. */
export const WORKBENCH_KEYBOARD_OPEN_COMMAND_ID = "workbench.keyboard.open";
export const WORKBENCH_KEYBOARD_SELECT_TAB_COMMAND_ID = "workbench.keyboard.selectTab";

export const keyboardEntryKind = (commandId: string) => {
  if (commandId === WORKBENCH_KEYBOARD_OPEN_COMMAND_ID) return "mode" as const;
  if (commandId === WORKBENCH_KEYBOARD_SELECT_TAB_COMMAND_ID) return "tab" as const;
  return undefined;
};
