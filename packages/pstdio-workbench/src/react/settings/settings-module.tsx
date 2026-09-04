import {
  type PreferenceScope,
  standardResourceIcons,
  type WorkbenchModuleContext,
  type WorkbenchModuleContribution,
} from "../../core";
import { SettingsOverlay } from "./settings-overlay";
import {
  isSettingsScopeVisible,
  settingsItemResource,
  settingsPanelResource,
  WORKBENCH_SETTINGS_OPEN_COMMAND_ID,
} from "./settings-resources";
import { SettingsSurfacePanel } from "./settings-surface-panel";
import { buildSettingsTreeBody, FALLBACK_SECTION_ID } from "./settings-tree";

export interface WorkbenchSettingsModuleOptions {
  /** Maps a preference scope (e.g. "project") to its scope id; project entries hide until this resolves. */
  resolveScopeId?: (scope: PreferenceScope) => string | undefined;
  /** Heading shown at the top of the settings overlay. */
  title?: string;
}

// The single overlay placement that hosts the whole settings surface.
export const WORKBENCH_SETTINGS_WIDGET_ID = "workbench.settings";
export const WORKBENCH_SETTINGS_NAV_WIDGET_ID = "workbench.settings.nav";
export const WORKBENCH_SETTINGS_PANEL_WIDGET_ID = "workbench.settings.panel";

// Built-in command to open settings at the first visible panel. Always registered
// by the surface, so it is available in the command palette without host wiring;
// hosts only add a curated menu item pointing at this id if they want one.
export { WORKBENCH_SETTINGS_OPEN_COMMAND_ID } from "./settings-resources";

const WIDGET_ID = WORKBENCH_SETTINGS_WIDGET_ID;

const openSettings = (input: { args: unknown; ctx: WorkbenchModuleContext; hasProjectScope: () => boolean }) => {
  const { args, ctx, hasProjectScope } = input;
  const requested = args && typeof args === "object" ? args : undefined;
  const panelId = requested && "panelId" in requested ? requested.panelId : undefined;
  const itemId = requested && "itemId" in requested ? requested.itemId : undefined;
  const requestedPanel = typeof panelId === "string" ? ctx.settings.getPanel(panelId) : undefined;
  const isVisible = (entry: NonNullable<typeof requestedPanel>) =>
    isSettingsScopeVisible(entry.scope, hasProjectScope()) && ctx.context.matches(entry.when);
  const panel =
    (requestedPanel && isVisible(requestedPanel) ? requestedPanel : undefined) ??
    ctx.settings.listPanels().find(isVisible);
  if (!panel) return undefined;
  const resource =
    panel.kind === "collection" && typeof itemId === "string"
      ? settingsItemResource(panel.id, { id: itemId, label: itemId })
      : settingsPanelResource(panel);
  ctx.overlays.openOverlay(WIDGET_ID, {
    resource,
    title: resource.label,
  });
  return resource;
};

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
      ctx.views.registerView({
        id: WORKBENCH_SETTINGS_NAV_WIDGET_ID,
        title: `${title} navigation`,
        body: {
          kind: "tree",
          // Settings sections read as a single scannable list, so every section starts expanded.
          defaultExpandedSectionIds: [...ctx.settings.listSections().map((section) => section.id), FALLBACK_SECTION_ID],
          getBody: () =>
            buildSettingsTreeBody({
              settings: ctx.settings,
              hasProjectScope: hasProjectScope(),
              matchesWhen: (when) => ctx.context.matches(when),
            }),
          getChildren: () => [],
        },
      });

      ctx.views.registerView({
        id: WORKBENCH_SETTINGS_PANEL_WIDGET_ID,
        title,
        body: {
          kind: "react",
          render: (input) => (
            <SettingsSurfacePanel input={input} settings={ctx.settings} resolveScopeId={options.resolveScopeId} />
          ),
        },
      });

      ctx.views.registerView({
        id: WIDGET_ID,
        title,
        body: {
          kind: "react",
          render: (input) => (
            <SettingsOverlay
              input={input}
              settings={ctx.settings}
              navTreeId={WORKBENCH_SETTINGS_NAV_WIDGET_ID}
              title={title}
              resolveScopeId={options.resolveScopeId}
            />
          ),
        },
      });
      ctx.overlays.registerOverlay({
        id: WIDGET_ID,
        viewId: WIDGET_ID,
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

      ctx.commands.registerCommand(
        {
          id: WORKBENCH_SETTINGS_OPEN_COMMAND_ID,
          label: "Open settings",
          category: "Settings",
          icon: standardResourceIcons.settings,
        },
        {
          execute: (args) => openSettings({ args, ctx, hasProjectScope }),
        },
      );

      // Keep the tree in sync as contributions register or their context conditions change.
      const refreshNavigation = () => {
        if (ctx.views.getView(WORKBENCH_SETTINGS_NAV_WIDGET_ID)) {
          ctx.views.refreshView(WORKBENCH_SETTINGS_NAV_WIDGET_ID);
        }
      };
      const unsubscribeSettings = ctx.settings.store.subscribe(refreshNavigation);
      const unsubscribeContext = ctx.context.store.subscribe(refreshNavigation);
      return {
        dispose() {
          unsubscribeSettings();
          unsubscribeContext();
        },
      };
    },
  };
};
