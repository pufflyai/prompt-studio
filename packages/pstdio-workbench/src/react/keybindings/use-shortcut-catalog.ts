import type { WorkbenchCoreContributionContext } from "../../core";
import { shortcutHints } from "../../core/controllers/keyboard/shortcut-menu";
import { useWorkbenchStore } from "../shared/use-workbench-store";

export const useShortcutCatalog = (workbench: WorkbenchCoreContributionContext) => {
  "use no memo";
  const keyboard = useWorkbenchStore(workbench.keyboard.store, (state) => state);
  useWorkbenchStore(workbench.keybindings.store, (state) => state.keybindings);
  useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  useWorkbenchStore(workbench.context.store, (state) => state.values);
  useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  const catalog = workbench.keyboard.catalog();
  return { state: keyboard, catalog, hints: shortcutHints(catalog, keyboard) };
};
