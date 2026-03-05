import { COLOR_COLS, COLOR_COUNT, colorAt } from "../../panels/color-picker";
import type { InputKey, KeyboardDeps } from "./types";
import { closeOverlay } from "./types";

export function handleSettingsInput(input: string, key: InputKey, deps: KeyboardDeps) {
  const { settingsCreateStep: createStep } = deps;

  if (createStep === "name") {
    handleNameInput(key, deps);
    return;
  }

  if (createStep === "color") {
    handleColorInput(input, key, deps);
    return;
  }

  if (deps.settingsColorPicker) {
    handleColorInput(input, key, deps);
    return;
  }

  handleNormalInput(input, key, deps);
}

function handleNameInput(key: InputKey, deps: KeyboardDeps) {
  if (key.escape) {
    deps.onSettingsCancelCreate();
    return;
  }
  // Enter is handled by the InputBar onSubmit
}

function handleColorInput(input: string, key: InputKey, deps: KeyboardDeps) {
  if (key.escape) {
    if (deps.settingsCreateStep === "color") {
      deps.onSettingsCancelCreate();
    } else {
      deps.onSettingsCloseColorPicker();
    }
    return;
  }

  if (key.upArrow) {
    deps.setSettingsColorIndex((i) => Math.max(0, i - COLOR_COLS));
    return;
  }
  if (key.downArrow) {
    deps.setSettingsColorIndex((i) => Math.min(COLOR_COUNT - 1, i + COLOR_COLS));
    return;
  }
  if (input === "h" || (key.shift && key.tab)) {
    deps.setSettingsColorIndex((i) => Math.max(0, i - 1));
    return;
  }
  if (input === "l" || key.tab) {
    deps.setSettingsColorIndex((i) => Math.min(COLOR_COUNT - 1, i + 1));
    return;
  }

  if (key.return) {
    const color = colorAt(deps.settingsColorIndex);
    deps.onSettingsColorConfirm(color);
    return;
  }
}

function handleNormalInput(input: string, key: InputKey, deps: KeyboardDeps) {
  if (key.escape) {
    closeOverlay(deps);
    return;
  }

  if (key.tab && !key.shift) {
    deps.onSettingsSwitchSection();
    return;
  }
  if (key.tab && key.shift) {
    deps.onSettingsSwitchSection();
    return;
  }

  if (key.downArrow) {
    deps.setSettingsIndex((i) => Math.min(i + 1, deps.settingsItemCount - 1));
    return;
  }
  if (key.upArrow) {
    deps.setSettingsIndex((i) => Math.max(i - 1, 0));
    return;
  }

  if (input === "g") {
    deps.setSettingsIndex(() => 0);
    return;
  }
  if (input === "G") {
    deps.setSettingsIndex(() => deps.settingsItemCount - 1);
    return;
  }

  if (input === "n") {
    deps.onSettingsStartCreate();
    return;
  }

  if (input === "c" && deps.settingsItemCount > 0) {
    deps.onSettingsOpenColorPicker();
    return;
  }

  if (input === "d" && deps.settingsSection === "statuses") {
    deps.onSettingsSetDefault();
    return;
  }

  if (input === "x" && deps.settingsItemCount > 0) {
    deps.onSettingsDelete();
    return;
  }
}
