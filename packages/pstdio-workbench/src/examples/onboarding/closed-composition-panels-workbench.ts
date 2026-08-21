import { createWorkbenchCore } from "../../core";

const modeId = "onboarding.closed-composition-panels";
const rendererId = "onboarding.closed-composition-panels.renderer";
const overviewId = "onboarding.closed-composition-panels.overview";

const optionalPanels = [
  { panelId: "onboarding.closed-composition-panels.artifacts", title: "Artifacts" },
  { panelId: "onboarding.closed-composition-panels.cams", title: "Cams" },
];

export const createClosedCompositionPanelsWorkbench = () => {
  const workbench = createWorkbenchCore();
  workbench.renderers.registerRenderer({ id: rendererId, render: () => null });
  workbench.layout.registerPanel({
    id: overviewId,
    title: "Overview",
    region: "main",
    rendererId,
  });
  for (const panel of optionalPanels) {
    workbench.layout.registerPanel({
      id: panel.panelId,
      title: panel.title,
      region: "main",
      rendererId,
      singleton: true,
    });
  }
  workbench.modes.registerMode({
    id: modeId,
    activate: () => undefined,
    listAddablePanels: ({ layout }) =>
      optionalPanels
        .filter((panel) => layout.regions.main.widgets.every((placement) => placement.contributionId !== panel.panelId))
        .map((panel) => ({ panelId: panel.panelId, region: "main" as const })),
  });
  workbench.layout.openWidget(overviewId, { closable: false, pinned: true, role: "location" });
  workbench.modes.setActiveMode(modeId);
  return workbench;
};
