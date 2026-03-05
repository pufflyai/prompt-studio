import type { InputKey, KeyboardDeps } from "./types";

export function handleTemplatesInput(input: string, key: InputKey, deps: KeyboardDeps) {
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
  if (key.downArrow) {
    deps.templateMoveTo(deps.templateSelectedIndex + 1);
    return;
  }
  if (key.upArrow) {
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
