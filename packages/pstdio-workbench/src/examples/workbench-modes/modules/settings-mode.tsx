import type { Disposable, WorkbenchModeActivationContext, WorkbenchModuleContributionContext } from "../../../core";
import { SettingsPage, SettingsStatus, SettingsTabs } from "../components/settings-views";
import { activityBarWidgetId, settingsWidgetIds, workbenchModes } from "../mock-data/data";

const setupSettingsMode = (ctx: WorkbenchModeActivationContext): Disposable[] => {
  const disposables: Disposable[] = [
    ctx.layout.registerWidget({
      id: settingsWidgetIds.tabs,
      title: "Settings tabs",
      region: "nav",
      singleton: true,
      rendererId: settingsWidgetIds.tabs,
    }),
    ctx.layout.registerWidget({
      id: settingsWidgetIds.page,
      title: workbenchModes.settings.label,
      region: "main",
      singleton: true,
      rendererId: settingsWidgetIds.page,
    }),
    ctx.layout.registerWidget({
      id: settingsWidgetIds.status,
      title: "Settings status",
      region: "status",
      singleton: true,
      rendererId: settingsWidgetIds.status,
    }),
    ctx.renderers.registerRenderer({
      id: settingsWidgetIds.tabs,
      render: () => <SettingsTabs />,
    }),
    ctx.renderers.registerRenderer({
      id: settingsWidgetIds.page,
      render: () => <SettingsPage />,
    }),
    ctx.renderers.registerRenderer({
      id: settingsWidgetIds.status,
      render: () => <SettingsStatus />,
    }),
  ];

  ctx.layout.openWidget(activityBarWidgetId, { pinned: true });
  ctx.layout.openWidget(settingsWidgetIds.tabs, { pinned: true });
  ctx.layout.openWidget(settingsWidgetIds.status, { pinned: true });
  ctx.layout.openWidget(settingsWidgetIds.page, { pinned: true });

  return disposables;
};

export const registerSettingsMode = (ctx: WorkbenchModuleContributionContext) => {
  ctx.modes.registerMode({
    id: workbenchModes.settings.id,
    label: workbenchModes.settings.label,
    activate: setupSettingsMode,
  });
};
