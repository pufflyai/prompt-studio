import type { ContributionMetadata } from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import type {
  WidgetContribution,
  WorkbenchLocationContribution,
  WorkbenchPanelContribution,
  WorkbenchPanelMenuContribution,
  WorkbenchPanelMenuDefinition,
  WorkbenchPanelRegion,
  WorkbenchSubPanelContribution,
} from "./layout-types";
import { workbenchPanelMenuRegions, workbenchPanelRegions } from "./layout-types";

type LegacyWorkbenchPanelContribution = WorkbenchLocationContribution | WorkbenchSubPanelContribution;
type RegisteredPanelInput = LegacyWorkbenchPanelContribution | WorkbenchPanelContribution;
type WorkbenchPanelKind = "panel" | "location" | "sub-panel";

interface RegisterPanelContributionInput {
  metadata?: ContributionMetadata;
  panel: RegisteredPanelInput;
  registerWidget(widget: WidgetContribution, metadata?: ContributionMetadata): Disposable;
  kind: WorkbenchPanelKind;
  closable?: boolean;
}

interface CreatePanelRegistrationsInput {
  registerWidget(widget: WidgetContribution, metadata?: ContributionMetadata): Disposable;
}

const panelMenuContribution = (
  panel: RegisteredPanelInput,
  menu: WorkbenchPanelMenuDefinition,
  kind: WorkbenchPanelKind,
): WidgetContribution => {
  const { side, ...contribution } = menu;
  const region = panel.region as WorkbenchPanelRegion;
  const fallbackRegion = workbenchPanelRegions.find((candidate) => candidate === panel.fallbackRegion);
  return {
    ...contribution,
    region: workbenchPanelMenuRegions[region][side],
    fallbackRegion: fallbackRegion ? workbenchPanelMenuRegions[fallbackRegion][side] : undefined,
    panelMenuOwner: {
      level: kind === "sub-panel" ? "sub-panel" : "panel",
      contributionId: panel.id,
    },
  };
};

export const registerPanelContribution = (input: RegisterPanelContributionInput) => {
  const { closable, kind, metadata, panel, registerWidget } = input;
  const { panelMenus = [], ...panelContribution } = panel;
  const registrations: Disposable[] = [];

  if (panelMenus.length > 0 && !workbenchPanelRegions.includes(panel.region as WorkbenchPanelRegion)) {
    throw new Error(`Panel Menus require a Panel region: ${panel.id}`);
  }

  try {
    const registeredPanel: WidgetContribution & { ownedPanelMenuIds: readonly string[] } = {
      ...panelContribution,
      ...(closable === undefined ? {} : { closable }),
      ownedPanelMenuIds: panelMenus.map((menu) => menu.id),
    };
    registrations.push(registerWidget(registeredPanel, metadata));
    for (const menu of panelMenus) {
      registrations.push(registerWidget(panelMenuContribution(panel, menu, kind), metadata));
    }
  } catch (error) {
    for (const registration of registrations.reverse()) registration.dispose();
    throw error;
  }

  return createDisposable(() => {
    for (const registration of registrations.reverse()) registration.dispose();
  });
};

export const createPanelRegistrations = (input: CreatePanelRegistrationsInput) => {
  const registerPanel = (panel: WorkbenchPanelContribution, metadata?: ContributionMetadata) => {
    return registerPanelContribution({
      panel,
      kind: panel.eligibleLocations ? "sub-panel" : "panel",
      metadata,
      registerWidget: input.registerWidget,
    });
  };

  const registerLocation = (location: WorkbenchLocationContribution, metadata?: ContributionMetadata) =>
    registerPanelContribution({
      panel: location,
      kind: "location",
      closable: location.closable ?? false,
      metadata,
      registerWidget: input.registerWidget,
    });

  const registerSubPanel = (subPanel: WorkbenchSubPanelContribution, metadata?: ContributionMetadata) =>
    registerPanelContribution({
      panel: { ...subPanel, eligibleLocations: subPanel.eligibleLocations ?? {} },
      kind: "sub-panel",
      closable: subPanel.closable ?? true,
      metadata,
      registerWidget: input.registerWidget,
    });

  const registerPanelMenu = (panelMenu: WorkbenchPanelMenuContribution, metadata?: ContributionMetadata) =>
    input.registerWidget({ ...panelMenu, panelMenuOwner: panelMenu.panelMenuOwner ?? { level: "panel" } }, metadata);

  return { registerPanel, registerLocation, registerSubPanel, registerPanelMenu };
};
