import type { ExtensionMenuContribution, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { Command, MenuItem, MenuPath, ResourceBrowseEntry, ResourceRef } from "pstdio-workbench/core";

export type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";

const placementOrder = { first: 0, default: 1, last: 2 } satisfies Record<
  NonNullable<ExtensionMenuContribution["placement"]>,
  number
>;

export type WorkbenchExtensionRoute = WorkbenchExtensionMetadata["routes"][number];

export interface WorkbenchExtensionRouteResourceInput {
  route: WorkbenchExtensionRoute;
}

export interface WorkbenchExtensionMenuSlotConfig {
  menuPath: MenuPath;
  group?: string;
  overflowLabel?: string;
}

export type WorkbenchExtensionMenuWhenBuilder = (contribution: ExtensionMenuContribution) => string | undefined;

export interface WorkbenchExtensionMenuRegistration {
  command: Command;
  contribution: ExtensionMenuContribution;
  menuItem: MenuItem;
  menuPath: MenuPath;
  targetCommandId: string;
}

export const emptyWorkbenchExtensionMetadata = {
  commands: [],
  diagnostics: [],
  extensions: [],
  menuContributions: [],
  modes: [],
  navigation: [],
  routes: [],
  dataRenderers: [],
  settingsPanels: [],
  settingsDefinitions: [],
  treeItems: [],
  views: [],
} satisfies WorkbenchExtensionMetadata;

const defaultWorkbenchExtensionCommandId = (contribution: ExtensionMenuContribution) =>
  `workbench.extension.menu.${contribution.id}`;

const contributionOrder = (contribution: ExtensionMenuContribution, index: number) =>
  placementOrder[contribution.placement ?? "default"] * 1000 + index;

const createMenuItem = (input: {
  contribution: ExtensionMenuContribution;
  commandId: string;
  index: number;
  slot: WorkbenchExtensionMenuSlotConfig;
  when?: string;
}) => {
  const { commandId, contribution, index, slot, when } = input;

  return {
    commandId,
    label: contribution.label,
    icon: contribution.icon,
    group: slot.group ?? contribution.group,
    overflowLabel: slot.overflowLabel,
    order: contributionOrder(contribution, index),
    when,
  } satisfies MenuItem;
};

export const buildWorkbenchExtensionMenuRegistrations = (input: {
  metadata: WorkbenchExtensionMetadata;
  menuSlotsById: ReadonlyMap<string, WorkbenchExtensionMenuSlotConfig>;
  menuTargetsById?: ReadonlyMap<string, WorkbenchExtensionMenuSlotConfig>;
  createCommandId?: (contribution: ExtensionMenuContribution) => string;
  createWhenExpression?: WorkbenchExtensionMenuWhenBuilder;
}) => {
  const {
    createCommandId = defaultWorkbenchExtensionCommandId,
    createWhenExpression,
    menuSlotsById,
    menuTargetsById,
    metadata,
  } = input;
  const registrations: WorkbenchExtensionMenuRegistration[] = [];

  metadata.menuContributions.forEach((contribution, index) => {
    const slot = contribution.target
      ? menuTargetsById?.get(contribution.target)
      : menuSlotsById.get(contribution.slotId);
    if (!slot) return;

    const commandId = createCommandId(contribution);
    const command = metadata.commands.find((candidate) => candidate.id === contribution.commandId);

    registrations.push({
      command: {
        id: commandId,
        label: contribution.label,
        category: contribution.group,
        description: command?.description,
        icon: contribution.icon,
      },
      contribution,
      menuItem: createMenuItem({ commandId, contribution, index, slot, when: createWhenExpression?.(contribution) }),
      menuPath: slot.menuPath,
      targetCommandId: contribution.commandId,
    });
  });

  return registrations;
};

export const buildWorkbenchExtensionRouteEntries = (input: {
  metadata: WorkbenchExtensionMetadata | undefined;
  createResource: (resourceInput: WorkbenchExtensionRouteResourceInput) => ResourceRef;
}) => {
  const { createResource, metadata } = input;
  if (!metadata) return [] as ResourceBrowseEntry[];

  return metadata.routes.map((route) => ({
    resource: createResource({ route }),
  }));
};
