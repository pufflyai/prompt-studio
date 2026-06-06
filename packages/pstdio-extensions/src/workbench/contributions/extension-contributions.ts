import type {
  ExtensionCommandPaletteContribution,
  ExtensionMenuContribution,
  WorkbenchExtensionMetadata,
} from "@pstdio/sdk/api";
import { isLocalizedString, type Localizable } from "@pstdio/sdk/extensions";
import type { Command, MenuItem, MenuPath, ResourceBrowseEntry, ResourceRef } from "pstdio-workbench/core";

export type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";

const placementOrder = { first: 0, default: 1, last: 2 } satisfies Record<
  NonNullable<ExtensionMenuContribution["placement"] | ExtensionCommandPaletteContribution["placement"]>,
  number
>;
type ExtensionContributionPlacement = keyof typeof placementOrder;

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
export type WorkbenchExtensionStringResolver = (value: Localizable<string> | undefined, extensionId: string) => string;

export interface WorkbenchExtensionMenuRegistration {
  command: Command;
  contribution: ExtensionMenuContribution;
  menuItem: MenuItem;
  menuPath: MenuPath;
  targetCommandId: string;
}

export interface WorkbenchExtensionCommandPaletteRegistration {
  command: Command;
  contribution: ExtensionCommandPaletteContribution;
  menuItem: MenuItem;
  targetCommandId: string;
}

export const emptyWorkbenchExtensionMetadata = {
  commands: [],
  commandPaletteContributions: [],
  diagnostics: [],
  extensions: [],
  menuContributions: [],
  modes: [],
  navigation: [],
  routes: [],
  dataRenderers: [],
  treeRenderers: [],
  settingsPanels: [],
  settingsDefinitions: [],
  treeItems: [],
  views: [],
} satisfies WorkbenchExtensionMetadata;

const defaultWorkbenchExtensionCommandId = (contribution: ExtensionMenuContribution) =>
  `workbench.extension.menu.${contribution.id}`;

const defaultWorkbenchExtensionPaletteCommandId = (contribution: ExtensionCommandPaletteContribution) =>
  `workbench.extension.palette.${contribution.id}`;

const contributionOrder = (contribution: { placement?: ExtensionContributionPlacement }, index: number) =>
  placementOrder[contribution.placement ?? "default"] * 1000 + index;

const text: WorkbenchExtensionStringResolver = (value) => {
  if (value === undefined) return "";
  if (!isLocalizedString(value)) return value;
  return value.default ?? value.$l10n;
};

const createMenuItem = (input: {
  contribution: ExtensionMenuContribution;
  commandId: string;
  index: number;
  slot: WorkbenchExtensionMenuSlotConfig;
  when?: string;
  resolveString: WorkbenchExtensionStringResolver;
}) => {
  const { commandId, contribution, index, resolveString, slot, when } = input;

  return {
    commandId,
    label: resolveString(contribution.label, contribution.extensionId),
    icon: contribution.icon,
    group: slot.group ?? contribution.group,
    overflowLabel: slot.overflowLabel,
    order: contributionOrder(contribution, index),
    when,
  } satisfies MenuItem;
};

const createPaletteItem = (input: {
  contribution: ExtensionCommandPaletteContribution;
  commandId: string;
  index: number;
  resolveString: WorkbenchExtensionStringResolver;
}) => {
  const { commandId, contribution, index, resolveString } = input;

  return {
    commandId,
    label: resolveString(contribution.label, contribution.extensionId),
    icon: contribution.icon,
    group: contribution.group,
    order: contributionOrder(contribution, index),
  } satisfies MenuItem;
};

export const buildWorkbenchExtensionMenuRegistrations = (input: {
  metadata: WorkbenchExtensionMetadata;
  menuSlotsById: ReadonlyMap<string, WorkbenchExtensionMenuSlotConfig>;
  menuTargetsById?: ReadonlyMap<string, WorkbenchExtensionMenuSlotConfig>;
  createCommandId?: (contribution: ExtensionMenuContribution) => string;
  createWhenExpression?: WorkbenchExtensionMenuWhenBuilder;
  resolveString?: WorkbenchExtensionStringResolver;
}) => {
  const {
    createCommandId = defaultWorkbenchExtensionCommandId,
    createWhenExpression,
    menuSlotsById,
    menuTargetsById,
    metadata,
    resolveString = text,
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
        label: resolveString(contribution.label, contribution.extensionId),
        category: contribution.group,
        description: command ? resolveString(command.description, command.extensionId) : undefined,
        icon: contribution.icon,
      },
      contribution,
      menuItem: createMenuItem({
        commandId,
        contribution,
        index,
        resolveString,
        slot,
        when: createWhenExpression?.(contribution),
      }),
      menuPath: slot.menuPath,
      targetCommandId: contribution.commandId,
    });
  });

  return registrations;
};

export const buildWorkbenchExtensionCommandPaletteRegistrations = (input: {
  metadata: WorkbenchExtensionMetadata;
  createCommandId?: (contribution: ExtensionCommandPaletteContribution) => string;
  resolveString?: WorkbenchExtensionStringResolver;
}) => {
  const { createCommandId = defaultWorkbenchExtensionPaletteCommandId, metadata, resolveString = text } = input;
  const registrations: WorkbenchExtensionCommandPaletteRegistration[] = [];

  (metadata.commandPaletteContributions ?? []).forEach((contribution, index) => {
    const commandId = createCommandId(contribution);
    const command = metadata.commands.find((candidate) => candidate.id === contribution.commandId);

    registrations.push({
      command: {
        id: commandId,
        label: resolveString(contribution.label, contribution.extensionId),
        category: contribution.group,
        description: command ? resolveString(command.description, command.extensionId) : undefined,
        icon: contribution.icon,
      },
      contribution,
      menuItem: createPaletteItem({ commandId, contribution, index, resolveString }),
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
