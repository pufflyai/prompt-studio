import type { ResourceRef, SettingsScope } from "../../core";

export const SETTINGS_RESOURCE_KIND = "workbench-settings";

export const settingsPanelResource = (panel: { id: string; title: string; icon?: string }): ResourceRef => ({
  kind: SETTINGS_RESOURCE_KIND,
  uri: `${SETTINGS_RESOURCE_KIND}://panel/${panel.id}`,
  id: panel.id,
  label: panel.title,
  icon: panel.icon,
  metadata: { panelId: panel.id },
});

export const settingsItemResource = (
  panelId: string,
  item: { id: string; label: string; icon?: string },
): ResourceRef => ({
  kind: SETTINGS_RESOURCE_KIND,
  uri: `${SETTINGS_RESOURCE_KIND}://item/${panelId}/${item.id}`,
  id: `${panelId}::${item.id}`,
  label: item.label,
  icon: item.icon,
  metadata: { panelId, itemId: item.id },
});

// Project-scoped entries stay hidden until a project scope id is available; global
// entries are always visible. Mirrors the old dashboards' projectless behavior.
export const isSettingsScopeVisible = (scope: SettingsScope | undefined, hasProjectScope: boolean) =>
  (scope ?? "project") !== "project" || hasProjectScope;
