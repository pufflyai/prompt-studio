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
  WorkbenchWidgetRole,
} from "./layout-types";
import { workbenchPanelMenuRegions, workbenchPanelRegions } from "./layout-types";

type LegacyWorkbenchPanelContribution = WorkbenchLocationContribution | WorkbenchSubPanelContribution;
type RegisteredPanelInput = LegacyWorkbenchPanelContribution | WorkbenchPanelContribution;
type WorkbenchPanelRole = Extract<WorkbenchWidgetRole, "content" | "location" | "sub-panel">;

interface RegisterPanelContributionInput {
  metadata?: ContributionMetadata;
  panel: RegisteredPanelInput;
  registerWidget(widget: WidgetContribution, metadata?: ContributionMetadata): Disposable;
  role: WorkbenchPanelRole;
  closable?: boolean;
}

interface CreatePanelRegistrationsInput {
  registerWidget(widget: WidgetContribution, metadata?: ContributionMetadata): Disposable;
}

const panelMenuContribution = (
  panel: RegisteredPanelInput,
  menu: WorkbenchPanelMenuDefinition,
  role: WorkbenchPanelRole,
): WidgetContribution => {
  const { side, ...contribution } = menu;
  const region = panel.region as WorkbenchPanelRegion;
  const fallbackRegion = workbenchPanelRegions.find((candidate) => candidate === panel.fallbackRegion);
  return {
    ...contribution,
    region: workbenchPanelMenuRegions[region][side],
    fallbackRegion: fallbackRegion ? workbenchPanelMenuRegions[fallbackRegion][side] : undefined,
    panelMenuOwner: {
      level: role === "sub-panel" ? "sub-panel" : "panel",
      contributionId: panel.id,
    },
    role: "panel-menu",
  };
};

export const registerPanelContribution = (input: RegisterPanelContributionInput) => {
  const { closable, metadata, panel, registerWidget, role } = input;
  const { panelMenus = [], ...panelContribution } = panel;
  const registrations: Disposable[] = [];

  if (panelMenus.length > 0 && !workbenchPanelRegions.includes(panel.region as WorkbenchPanelRegion)) {
    throw new Error(`Panel Menus require a Panel region: ${panel.id}`);
  }

  try {
    const registeredPanel: WidgetContribution & { ownedPanelMenuIds: readonly string[] } = {
      ...panelContribution,
      closable: closable ?? role === "sub-panel",
      ownedPanelMenuIds: panelMenus.map((menu) => menu.id),
      role,
    };
    registrations.push(registerWidget(registeredPanel, metadata));
    for (const menu of panelMenus) {
      registrations.push(registerWidget(panelMenuContribution(panel, menu, role), metadata));
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
  const panelRole = (panel: WorkbenchPanelContribution): WorkbenchPanelRole => {
    if (panel.eligibleLocations) return "sub-panel";
    return "content";
  };

  const registerPanel = (panel: WorkbenchPanelContribution, metadata?: ContributionMetadata) => {
    return registerPanelContribution({
      panel,
      role: panelRole(panel),
      closable: panel.closable,
      metadata,
      registerWidget: input.registerWidget,
    });
  };

  const registerLocation = (location: WorkbenchLocationContribution, metadata?: ContributionMetadata) =>
    registerPanelContribution({ panel: location, role: "location", metadata, registerWidget: input.registerWidget });

  const registerSubPanel = (subPanel: WorkbenchSubPanelContribution, metadata?: ContributionMetadata) =>
    registerPanelContribution({ panel: subPanel, role: "sub-panel", metadata, registerWidget: input.registerWidget });

  const registerPanelMenu = (panelMenu: WorkbenchPanelMenuContribution, metadata?: ContributionMetadata) =>
    input.registerWidget({ ...panelMenu, role: "panel-menu" }, metadata);

  return { registerPanel, registerLocation, registerSubPanel, registerPanelMenu };
};
