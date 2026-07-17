import { type PreferenceScope, standardResourceIcons, type WorkbenchModuleContribution } from "../../core";
import { isSettingsScopeVisible, SETTINGS_RESOURCE_KIND, settingsPanelResource } from "./settings-resources";
import { buildSettingsTreeBody, FALLBACK_SECTION_ID } from "./settings-tree";

export interface WorkbenchSettingsModuleOptions {
  /** Maps a preference scope (e.g. "project") to its scope id; project entries hide until this resolves. */
  resolveScopeId?: (scope: PreferenceScope) => string | undefined;
  /** Heading shown at the top of the settings overlay. */
  title?: string;
}

// Built-in command to open settings at the first visible panel. Always registered
// by the surface, so it is available in the command palette without host wiring;
// hosts only add a curated menu item pointing at this id if they want one.
export const WORKBENCH_SETTINGS_OPEN_COMMAND_ID = "workbench.settings.open";

const NAV_TREE_ID = "workbench.settings.navigation";

// The unified Settings surface: a full-window modal overlay containing a nav tree
// (derived from `ctx.settings`) and a dispatching panel, plus a resource opener
// that pops the overlay. Contributors only call ctx.settings.registerSection/
// registerPanel — this renders and wires everything; hosts add no mode or opener.
export const createWorkbenchSettingsModule = (
  options: WorkbenchSettingsModuleOptions = {},
): WorkbenchModuleContribution => {
  const title = options.title ?? "Settings";
  const hasProjectScope = () => options.resolveScopeId?.("project") !== undefined;

  return {
    id: "workbench.settings.surface",
    activate(ctx) {
      ctx.renderers.registerTreeRenderer({
        id: NAV_TREE_ID,
        title,
        // Settings sections read as a single scannable list, so every section starts expanded.
        defaultExpandedSectionIds: [...ctx.settings.listSections().map((section) => section.id), FALLBACK_SECTION_ID],
        getBody: () => buildSettingsTreeBody({ settings: ctx.settings, hasProjectScope: hasProjectScope() }),
        getChildren: () => [],
      });

      ctx.settings.registerSurface({
        title,
        navigationTreeId: NAV_TREE_ID,
        resolveScopeId: options.resolveScopeId,
      });

      ctx.resources.registerKind({
        kind: SETTINGS_RESOURCE_KIND,
        label: "Settings",
        icon: standardResourceIcons.settings,
      });
      ctx.resources.registerOpener({
        id: "workbench.settings.opener",
        canOpen: (resource) => resource.kind === SETTINGS_RESOURCE_KIND,
        open: (resource) => ctx.settings.open(resource),
      });

      ctx.commands.registerCommand(
        {
          id: WORKBENCH_SETTINGS_OPEN_COMMAND_ID,
          label: "Open settings",
          category: "Settings",
          icon: standardResourceIcons.settings,
        },
        {
          execute: () => {
            const panel = ctx.settings
              .listPanels()
              .find((entry) => isSettingsScopeVisible(entry.scope, hasProjectScope()));
            if (!panel) return undefined;
            return ctx.resources.openResource(settingsPanelResource(panel), { replaceActive: true });
          },
        },
      );

      // Keep the tree in sync as contributions register/unregister.
      return { dispose: ctx.settings.store.subscribe(() => ctx.renderers.refresh(NAV_TREE_ID)) };
    },
  };
};
