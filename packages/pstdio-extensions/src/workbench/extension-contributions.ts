import type { DashboardExtensionMetadata, ExtensionMenuContribution, ExtensionNavigationRecord } from "@pstdio/sdk/api";
import type {
  Command,
  MenuItem,
  MenuPath,
  ResourceBrowseEntry,
  ResourceRef,
  TreeViewSection,
} from "pstdio-workbench/core";
import { getSlotContributions } from "../runtime-ui";

const placementOrder = { first: 0, default: 1, last: 2 } satisfies Record<
  NonNullable<ExtensionMenuContribution["placement"]>,
  number
>;

export type WorkbenchExtensionMetadata = DashboardExtensionMetadata;
export type WorkbenchExtensionRoute = WorkbenchExtensionMetadata["routes"][number];

export interface WorkbenchExtensionRouteResourceInput {
  route: WorkbenchExtensionRoute;
  navigation?: ExtensionNavigationRecord;
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
  settingsPanels: [],
  views: [],
} satisfies WorkbenchExtensionMetadata;

const defaultExtensionNavigationSectionId = (group: string) => `extension-navigation-group:${group}`;

const defaultWorkbenchExtensionCommandId = (contribution: ExtensionMenuContribution) =>
  `workbench.extension.menu.${contribution.id}`;

const contributionOrder = (contribution: ExtensionMenuContribution, index: number) =>
  placementOrder[contribution.placement ?? "default"] * 1000 + index;

const getRouteByPath = (metadata: Pick<WorkbenchExtensionMetadata, "routes">) =>
  new Map(metadata.routes.map((route) => [route.path, route]));

const getNavigationByRoutePath = (input: { metadata: WorkbenchExtensionMetadata; navigationSlotId: string }) => {
  const { metadata, navigationSlotId } = input;
  const navigationByRoutePath = new Map<string, ExtensionNavigationRecord>();

  for (const navigation of getSlotContributions(metadata.navigation, navigationSlotId)) {
    if (!navigation.route || !navigation.group) continue;
    navigationByRoutePath.set(navigation.route, navigation);
  }

  return navigationByRoutePath;
};

export const buildWorkbenchExtensionNavigationSections = (input: {
  metadata: WorkbenchExtensionMetadata;
  slotId: string;
  createResource: (resourceInput: WorkbenchExtensionRouteResourceInput) => ResourceRef;
  createSectionId?: (group: string) => string;
}) => {
  const { createResource, createSectionId = defaultExtensionNavigationSectionId, metadata, slotId } = input;
  const routeByPath = getRouteByPath(metadata);
  const sectionsByGroup = new Map<string, TreeViewSection>();

  for (const navigation of getSlotContributions(metadata.navigation, slotId)) {
    if (!navigation.route || !navigation.group) continue;

    const route = routeByPath.get(navigation.route);
    if (!route) continue;

    const group = navigation.group;
    const section = sectionsByGroup.get(group) ?? {
      id: createSectionId(group),
      label: group,
      collapsible: false,
      nodes: [],
    };
    const resource = createResource({ route, navigation });

    section.nodes.push({
      id: resource.uri,
      label: navigation.label,
      icon: navigation.icon,
      resource,
    });
    sectionsByGroup.set(group, section);
  }

  return [...sectionsByGroup.values()];
};

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
  createCommandId?: (contribution: ExtensionMenuContribution) => string;
  createWhenExpression?: WorkbenchExtensionMenuWhenBuilder;
}) => {
  const { createCommandId = defaultWorkbenchExtensionCommandId, createWhenExpression, menuSlotsById, metadata } = input;
  const registrations: WorkbenchExtensionMenuRegistration[] = [];

  metadata.menuContributions.forEach((contribution, index) => {
    const slot = menuSlotsById.get(contribution.slotId);
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
  navigationSlotId: string;
  createResource: (resourceInput: WorkbenchExtensionRouteResourceInput) => ResourceRef;
}) => {
  const { createResource, metadata, navigationSlotId } = input;
  if (!metadata) return [] as ResourceBrowseEntry[];

  const navigationByRoutePath = getNavigationByRoutePath({ metadata, navigationSlotId });

  return metadata.routes.map((route) => {
    const navigation = navigationByRoutePath.get(route.path);

    return {
      resource: createResource({ route, navigation }),
      group: navigation?.group,
    };
  });
};
