import type { WorkbenchCore } from "../../workbench-core-types";
import type { KeyboardPresentation } from "./keyboard-presentations";
import { type ResolvedShortcut, resolveShortcutCatalog } from "./shortcut-catalog";

/** Every hint in a render shares one derived catalog for the same workbench inputs. */
export const createShortcutCatalogReader = (
  getCore: () => WorkbenchCore,
  visibleTargets: () => KeyboardPresentation[],
) => {
  let inputs: unknown[] = [];
  let snapshot: ResolvedShortcut[] | undefined;
  return {
    invalidate() {
      snapshot = undefined;
    },
    read(fresh = false) {
      const core = getCore();
      const next = [
        core.keybindings.store.getState(),
        core.commands.store.getState(),
        core.context.store.getState(),
        core.layout.store.getState(),
        core.layout.menuStore.getState(),
        core.pages.store.getState(),
        core.views.store.getState(),
        core.resources.store.getState(),
      ];
      if (fresh || !snapshot || next.some((value, index) => value !== inputs[index])) {
        snapshot = resolveShortcutCatalog(core, visibleTargets());
        inputs = next;
      }
      return snapshot;
    },
  };
};
