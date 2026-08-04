import { type PreferenceScope, standardResourceIcons, type WorkbenchModuleContribution } from "../../core";
import { SettingsOverlay } from "./settings-overlay";
import { isSettingsScopeVisible, SETTINGS_RESOURCE_KIND, settingsPanelResource } from "./settings-resources";
import { SettingsSurfacePanel } from "./settings-surface-panel";
import { buildSettingsTreeBody, FALLBACK_SECTION_ID } from "./settings-tree";

export interface WorkbenchSettingsModuleOptions {
  /** Maps a preference scope (e.g. "project") to its scope id; project entries hide until this resolves. */
  resolveScopeId?: (scope: PreferenceScope) => string | undefined;
  /** Heading shown at the top of the settings overlay. */
  title?: string;
}

// The single overlay widget that hosts the whole settings surface. Exported so a
// host can open settings directly (e.g. ctx.layout.openPanel(...)) or assert it
// in tests — but hosts normally just open a settings resource and let the presenter
// below place it here.
export const WORKBENCH_SETTINGS_WIDGET_ID = "workbench.settings";
export const WORKBENCH_SETTINGS_NAV_WIDGET_ID = "workbench.settings.nav";
export const WORKBENCH_SETTINGS_PANEL_WIDGET_ID = "workbench.settings.panel";

// Built-in command to open settings at the first visible panel. Always registered
// by the surface, so it is available in the command palette without host wiring;
// hosts only add a curated menu item pointing at this id if they want one.
export const WORKBENCH_SETTINGS_OPEN_COMMAND_ID = "workbench.settings.open";

const WIDGET_ID = WORKBENCH_SETTINGS_WIDGET_ID;
const RENDERER_ID = "workbench.settings.renderer";
const PANEL_RENDERER_ID = "workbench.settings.panel.renderer";
const NAV_TREE_ID = "workbench.settings.navigation";

// The unified Settings surface: a full-window modal overlay containing a nav tree
// (derived from `ctx.settings`) and a dispatching panel, plus a resource presenter
// that pops the overlay. Contributors only call ctx.settings.registerSection/
// registerPanel — this renders and wires everything; hosts add no mode or presenter.
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

      ctx.layout.registerPanel({
        closable: false,
        id: WORKBENCH_SETTINGS_NAV_WIDGET_ID,
        title: `${title} navigation`,
        region: "sidenav",
        singleton: true,
        rendererId: NAV_TREE_ID,
      });

      ctx.layout.registerPanel({
        closable: false,
        id: WORKBENCH_SETTINGS_PANEL_WIDGET_ID,
        title,
        region: "main",
        singleton: true,
        rendererId: PANEL_RENDERER_ID,
      });
      ctx.renderers.registerRenderer({
        id: PANEL_RENDERER_ID,
        render: (input) => (
          <SettingsSurfacePanel input={input} settings={ctx.settings} resolveScopeId={options.resolveScopeId} />
        ),
      });

      ctx.layout.registerPanel({
        id: WIDGET_ID,
        title,
        region: "overlay",
        singleton: true,
        closable: true,
        rendererId: RENDERER_ID,
        config: {
          size: "xl",
          scrollBehavior: "inside",
          contentHeight: "min(760px, 88vh)",
          contentMaxWidth: "min(1440px, 94vw)",
          contentWidth: "94vw",
          closeTriggerTop: "3.5",
          // Settings hosts nested overlays (confirmations, popovers) that portal
          // outside this dialog's content; outside-interact dismissal would treat
          // clicks in them as "close settings". Esc and the close button remain.
          closeOnInteractOutside: false,
        },
      });
      ctx.renderers.registerRenderer({
        id: RENDERER_ID,
        render: (input) => (
          <SettingsOverlay
            input={input}
            settings={ctx.settings}
            navTreeId={NAV_TREE_ID}
            title={title}
            resolveScopeId={options.resolveScopeId}
          />
        ),
      });

      ctx.resources.registerKind({
        kind: SETTINGS_RESOURCE_KIND,
        label: "Settings",
        icon: standardResourceIcons.settings,
      });
      ctx.resources.registerPresenter({
        id: "workbench.settings.presenter",
        canOpen: (resource) => resource.kind === SETTINGS_RESOURCE_KIND,
        open: (resource) => ctx.layout.openPanel(WIDGET_ID, { resource, title: resource.label }),
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
