import type {
  ExtensionCommandPaletteContribution,
  ExtensionMenuContribution,
  WorkbenchExtensionMetadata,
} from "@pstdio/sdk/api";
import { isLocalizedString, type Localizable } from "@pstdio/sdk/extensions";
import type { Command, MenuItem, MenuPath } from "../../core";
import { localizeParamSchema } from "./param-schema-localization";

export type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";

const placementOrder = { first: 0, default: 1, last: 2 } satisfies Record<
  NonNullable<ExtensionMenuContribution["placement"] | ExtensionCommandPaletteContribution["placement"]>,
  number
>;
type ExtensionContributionPlacement = keyof typeof placementOrder;

export interface WorkbenchExtensionMenuSlotConfig {
  menuPath: MenuPath;
  group?: string;
  overflowLabel?: string;
  resourceGroup?: { id: string; label: string };
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

export interface UnresolvedWorkbenchExtensionMenuContribution {
  contribution: ExtensionMenuContribution;
  targetId: string;
}

export const emptyWorkbenchExtensionMetadata = {
  commands: [],
  commandPaletteContributions: [],
  diagnostics: [],
  extensions: [],
  menuContributions: [],
  modes: [],
  pages: [],
  views: [],
  viewMenus: [],
  placements: [],
  resourceKinds: [],
  navigationItems: [],
  navigationTrees: [],
  statusBarItems: [],
  settingsPanels: [],
  settingsDefinitions: [],
} satisfies WorkbenchExtensionMetadata;

type CommandContributionMetadata = Pick<
  WorkbenchExtensionMetadata,
  "commands" | "commandPaletteContributions" | "menuContributions"
>;

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
  disabledWhen?: string;
  resolveString: WorkbenchExtensionStringResolver;
}) => {
  const { commandId, contribution, index, resolveString, slot, when, disabledWhen } = input;

  return {
    commandId,
    id: contribution.id,
    sourceCommandId: contribution.commandId,
    label: resolveString(contribution.label, contribution.extensionId),
    icon: contribution.icon,
    group: slot.group ?? contribution.group,
    resourceGroup: slot.resourceGroup,
    args: contribution.params,
    overflowLabel: slot.overflowLabel,
    order: contributionOrder(contribution, index),
    when,
    disabledWhen,
    disabledReason: resolveString(contribution.disabledReason, contribution.extensionId),
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
    sourceCommandId: contribution.commandId,
    label: resolveString(contribution.label, contribution.extensionId),
    icon: contribution.icon,
    group: contribution.group,
    args: contribution.params,
    order: contributionOrder(contribution, index),
  } satisfies MenuItem;
};

export const buildWorkbenchExtensionMenuRegistrations = (input: {
  metadata: CommandContributionMetadata;
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
  const unresolved: UnresolvedWorkbenchExtensionMenuContribution[] = [];

  metadata.menuContributions.forEach((contribution, index) => {
    const slot = contribution.target
      ? menuTargetsById?.get(contribution.target)
      : menuSlotsById.get(contribution.slotId);
    if (!slot) {
      unresolved.push({ contribution, targetId: contribution.target ?? contribution.slotId });
      return;
    }

    const commandId = createCommandId(contribution);
    const command = metadata.commands.find((candidate) => candidate.id === contribution.commandId);

    registrations.push({
      command: {
        id: commandId,
        label: resolveString(contribution.label, contribution.extensionId),
        category: contribution.group,
        resourceMutation: command?.resourceMutation,
        description: command ? resolveString(command.description, command.extensionId) : undefined,
        icon: contribution.icon,
        params: localizeParamSchema(
          command?.params,
          (value) => resolveString(value, command?.extensionId ?? contribution.extensionId),
          command?.extensionId,
        ),
      },
      contribution,
      menuItem: createMenuItem({
        commandId,
        contribution,
        index,
        resolveString,
        slot,
        when: createWhenExpression?.(contribution),
        disabledWhen: contribution.disabledWhen
          ? createWhenExpression?.({ ...contribution, when: contribution.disabledWhen })
          : undefined,
      }),
      menuPath: slot.menuPath,
      targetCommandId: contribution.commandId,
    });
  });

  return { registrations, unresolved };
};

export const buildWorkbenchExtensionCommandPaletteRegistrations = (input: {
  metadata: CommandContributionMetadata;
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
        params: localizeParamSchema(
          command?.params,
          (value) => resolveString(value, command?.extensionId ?? contribution.extensionId),
          command?.extensionId,
        ),
      },
      contribution,
      menuItem: createPaletteItem({ commandId, contribution, index, resolveString }),
      targetCommandId: contribution.commandId,
    });
  });

  return registrations;
};
