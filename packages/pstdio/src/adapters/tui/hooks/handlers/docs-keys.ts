import type { InputKey, KeyboardDeps } from "./types";

export function handleDocsInput(input: string, key: InputKey, deps: KeyboardDeps) {
  if (key.downArrow) {
    deps.docsMoveTo(deps.docsSelectedIndex + 1);
    return;
  }
  if (key.upArrow) {
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
