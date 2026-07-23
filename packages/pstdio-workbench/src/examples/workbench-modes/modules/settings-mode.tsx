import type { Disposable, WorkbenchModeActivationContext, WorkbenchModuleContributionContext } from "../../../core";
import { SettingsPage } from "../components/settings-views";
import { activityBarWidgetId, settingsWidgetIds, workbenchModes } from "../mock-data/data";

const setupSettingsMode = (ctx: WorkbenchModeActivationContext): Disposable[] => {
  const disposables: Disposable[] = [
    ctx.layout.registerWidget({
      id: settingsWidgetIds.page,
      title: workbenchModes.settings.label,
      region: "main",
      singleton: true,
      rendererId: settingsWidgetIds.page,
    }),
    ctx.renderers.registerRenderer({
      id: settingsWidgetIds.page,
      render: () => <SettingsPage />,
    }),
  ];

  return disposables;
};

const seedSettingsMode = (ctx: WorkbenchModeActivationContext) => {
  ctx.layout.openWidget(activityBarWidgetId, { pinned: true });
  ctx.layout.openWidget(settingsWidgetIds.page, { pinned: true });
};

export const registerSettingsMode = (ctx: WorkbenchModuleContributionContext) => {
  ctx.modes.registerMode({
    id: workbenchModes.settings.id,
    label: workbenchModes.settings.label,
    panels: ["main"],
    activate: setupSettingsMode,
    seed: seedSettingsMode,
  });
};
