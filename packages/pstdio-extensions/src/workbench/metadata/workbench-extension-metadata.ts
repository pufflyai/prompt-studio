import type {
  ExtensionKeybindingRecord,
  ExtensionMenuContribution,
  ExtensionSettingDefinitionRecord,
  WorkbenchExtensionMetadata,
} from "@pstdio/sdk/api";
import type { ContributionKind, ContributionRef, NavigationTarget, WhenExpression } from "@pstdio/sdk/extensions";
import { toCommandPaletteContributions } from "../../runtime/command-palette-contributions";
import { serializeWhenExpression } from "../../runtime/normalize/references";
import type { ExtensionRuntime } from "../../types/runtime";
import { commandRef, normalizedRef, refreshEventIds } from "./workbench-extension-metadata-normalizers";
import {
  type ResolveWorkbenchExtensionWebview,
  type ResolveWorkbenchExtensionWebviewInput,
  toViewRecord,
} from "./workbench-extension-view-metadata";

export type { ResolveWorkbenchExtensionWebview, ResolveWorkbenchExtensionWebviewInput };

type MetadataNavigationTarget = WorkbenchExtensionMetadata["navigationItems"][number]["action"];
type MetadataWhen = WorkbenchExtensionMetadata["navigationItems"][number]["when"];

export interface CreateWorkbenchExtensionMetadataInput {
  runtime: ExtensionRuntime;
  resolveWebview?: ResolveWorkbenchExtensionWebview;
}

const compact = <T>(items: Array<T | null>) => items.filter((item): item is T => item !== null);

const toExtensionRecord = (extension: ExtensionRuntime["extensions"][number]) => ({
  id: extension.id,
  name: extension.name,
  displayName: extension.displayName,
  version: extension.version,
  description: extension.description,
  sourcePath: extension.sourcePath,
});

const toCommandRecord = (command: ExtensionRuntime["commands"][number]) => ({
  id: command.id,
  extensionId: command.extensionId,
  title: command.title,
  description: command.description,
  cliPath: command.cli?.pathKey,
  cliAliases: command.cli?.globalAliases?.map((alias) => alias.join(" ")),
  examples: command.cli?.examples,
  automation: command.automation,
  params: command.params as WorkbenchExtensionMetadata["commands"][number]["params"],
});

const toMenuContributions = (commands: ExtensionRuntime["commands"]): ExtensionMenuContribution[] =>
  commands.flatMap((command) =>
    command.menus.map((menu, index) => ({
      id: `${command.id}.menu.${index}`,
      extensionId: command.extensionId,
      commandId: command.id,
      slotId: menu.slot.id,
      label: menu.label ?? command.title,
      group: menu.group,
      placement: menu.placement,
      icon: menu.icon,
      presentation: menu.presentation,
      params: menu.params as Record<string, unknown> | undefined,
      when: serializeWhenExpression(menu.when, command.extensionId) as ExtensionMenuContribution["when"],
    })),
  );

const normalizeWhen = (when: WhenExpression | undefined, extensionId: string): MetadataWhen => {
  if (!when) return undefined;
  const normalizeRefs = <Kind extends ContributionKind>(
    value: ContributionRef<Kind> | readonly ContributionRef<Kind>[] | undefined,
  ) =>
    value
      ? Array.isArray(value)
        ? value.map((ref) => normalizedRef(ref, extensionId))
        : normalizedRef(value as ContributionRef<Kind>, extensionId)
      : undefined;
  return {
    ...when,
    mode: normalizeRefs(when.mode),
    view: normalizeRefs(when.view),
    resourceType: when.resourceType?.map((ref) => normalizedRef(ref, extensionId)),
  } as MetadataWhen;
};

const normalizeTarget = (target: NavigationTarget, extensionId: string): MetadataNavigationTarget => {
  if (target.kind === "view") return { ...target, view: normalizedRef(target.view, extensionId) };
  if (target.kind === "command") {
    return { ...target, target: { ...target.target, command: commandRef(target.target.command, extensionId) } };
  }
  if (target.kind === "compound") {
    return {
      ...target,
      targets: target.targets.map(
        (item) => normalizeTarget(item, extensionId) as Exclude<MetadataNavigationTarget, { kind: "compound" }>,
      ),
    };
  }
  return target;
};

export const toKeybindingRecord = (binding: ExtensionRuntime["keybindings"][number]): ExtensionKeybindingRecord => {
  const overrides: ExtensionKeybindingRecord["platformOverrides"] = {};
  if (binding.contribution.mac) overrides.mac = binding.contribution.mac;
  if (binding.contribution.linux) overrides.linux = binding.contribution.linux;
  if (binding.contribution.win) overrides.win = binding.contribution.win;
  return {
    id: binding.id,
    extensionId: binding.extensionId,
    commandId: binding.commandId,
    key: binding.contribution.key,
    canonicalChord: binding.canonicalChord,
    parsed: binding.parsed,
    platformOverrides: Object.keys(overrides).length > 0 ? overrides : undefined,
    when: serializeWhenExpression(binding.when, binding.extensionId) as ExtensionKeybindingRecord["when"],
    args: binding.contribution.params as Record<string, unknown> | undefined,
  };
};

const toSettingDefinitionRecord = (
  setting: ExtensionRuntime["settings"][number],
): ExtensionSettingDefinitionRecord => ({
  key: setting.key,
  extensionId: setting.extensionId,
  type: setting.contribution.type,
  scope: setting.contribution.scope,
  default: setting.contribution.default,
  enum: setting.contribution.enum,
  title: setting.contribution.title,
  description: setting.contribution.description,
});

const toCommandPaletteResource = (provider: ExtensionRuntime["commandPaletteResources"][number]) => {
  const queryHandlerId = (provider.contribution as typeof provider.contribution & { queryHandlerId?: string })
    .queryHandlerId;
  if (!queryHandlerId) return null;
  return {
    id: provider.id,
    extensionId: provider.extensionId,
    title: provider.contribution.title,
    resourceKind: provider.contribution.resourceKind?.id,
    queryHandlerId,
    refreshEventIds: refreshEventIds(provider.contribution.refreshEvents, provider.extensionId),
  };
};

export const createWorkbenchExtensionMetadata = (
  input: CreateWorkbenchExtensionMetadataInput,
): WorkbenchExtensionMetadata => ({
  extensions: input.runtime.extensions.map(toExtensionRecord),
  commands: input.runtime.commands.map(toCommandRecord),
  menuContributions: toMenuContributions(input.runtime.commands),
  commandPaletteContributions: toCommandPaletteContributions(input.runtime.commands).map((contribution) => ({
    ...contribution,
    when: serializeWhenExpression(
      input.runtime.commands.find((command) => command.id === contribution.commandId)?.palette[0]?.when,
      contribution.extensionId,
    ) as typeof contribution.when,
  })),
  modes: input.runtime.modes.map((mode) => ({
    id: mode.id,
    localId: mode.localId,
    extensionId: mode.extensionId,
    label: mode.contribution.label,
    icon: mode.contribution.icon,
  })),
  views: compact(input.runtime.views.map((view) => toViewRecord(input, view))),
  viewMenus: input.runtime.viewMenus.map((menu) => ({
    id: menu.id,
    extensionId: menu.extensionId,
    owner: normalizedRef(menu.contribution.owner, menu.extensionId),
    view: normalizedRef(menu.contribution.view, menu.extensionId),
    side: menu.contribution.side,
    group: menu.contribution.group,
    placement: menu.contribution.placement,
    hostTreeHeader: menu.contribution.hostTreeHeader,
    hostTreeFooter: menu.contribution.hostTreeFooter,
  })),
  placements: input.runtime.placements.map((placement) => ({
    id: placement.id,
    localId: placement.localId,
    extensionId: placement.extensionId,
    mode: normalizedRef(placement.contribution.mode, placement.extensionId),
    item:
      placement.contribution.item.kind === "view"
        ? { kind: "view", view: normalizedRef(placement.contribution.item.view, placement.extensionId) }
        : {
            kind: "resource-slot",
            slot: {
              ...placement.contribution.item.slot,
              resourceKind: normalizedRef(placement.contribution.item.slot.resourceKind, placement.extensionId),
            },
          },
    region: placement.contribution.region,
    order: placement.contribution.order,
    defaultOpen: placement.contribution.defaultOpen,
    required: placement.contribution.required,
    movableTo: placement.contribution.movableTo ? [...placement.contribution.movableTo] : undefined,
  })),
  resourceKinds: input.runtime.resourceKinds.map((record) => ({
    id: record.id,
    localId: record.localId,
    extensionId: record.extensionId,
    surface: record.contribution.surface,
    label: record.contribution.label,
    icon: record.contribution.icon,
    slots: Object.entries(record.contribution.slots).map(([id, slot]) => ({
      id,
      cardinality: slot.cardinality,
      access: slot.external ? ("public" as const) : ("owner" as const),
    })),
    menuSlots: Object.entries(record.contribution.menuSlots ?? {}).map(([id, slot]) => ({
      id,
      placement: slot.placement,
      label: slot.label,
      access: slot.external ? ("public" as const) : ("owner" as const),
      order: slot.order,
    })),
  })),
  resourceViews: input.runtime.resourceViews.map((record) => {
    const contribution = record.contribution as {
      resourceKind: ContributionRef<"resource-kind">;
      slot: { resourceKind: ContributionRef<"resource-kind">; id: string };
      view: ContributionRef<"view">;
      order?: number;
    };
    return {
      id: record.id,
      extensionId: record.extensionId,
      resourceKind: normalizedRef(contribution.resourceKind, record.extensionId),
      slot: {
        ...contribution.slot,
        resourceKind: normalizedRef(contribution.slot.resourceKind, record.extensionId),
      },
      view: normalizedRef(contribution.view, record.extensionId),
      order: contribution.order,
    };
  }),
  resourceHierarchyProviders: input.runtime.resourceHierarchyProviders.map((record) => ({
    id: record.id,
    extensionId: record.extensionId,
    resourceKind: normalizedRef(record.provider.resourceKind, record.extensionId),
  })),
  navigationItems: input.runtime.navigationItems.map((item) => ({
    id: item.id,
    extensionId: item.extensionId,
    slot: normalizedRef(item.contribution.slot, item.extensionId),
    label: item.contribution.label,
    icon: item.contribution.icon,
    group: item.contribution.group,
    order: item.contribution.order,
    when: normalizeWhen(item.contribution.when, item.extensionId),
    action: normalizeTarget(item.contribution.action, item.extensionId),
  })),
  statusBarItems: input.runtime.statusBarItems.map((item) => ({
    id: item.id,
    extensionId: item.extensionId,
    view: normalizedRef(item.contribution.view, item.extensionId),
    slot: item.contribution.slot,
    order: item.contribution.order,
    when: normalizeWhen(item.contribution.when, item.extensionId),
  })),
  statuses: input.runtime.statuses.map((record) => {
    const contribution = record.contribution as typeof record.contribution & {
      queryHandlerId: string;
      saveHandlerId?: string;
    };
    return {
      id: record.id,
      localId: record.localId,
      extensionId: record.extensionId,
      title: contribution.title,
      actions: contribution.actions ? [...contribution.actions] : undefined,
      queryHandlerId: contribution.queryHandlerId,
      saveHandlerId: contribution.saveHandlerId,
    };
  }),
  activityItems: input.runtime.activityItems.map((item) => ({
    id: item.id,
    extensionId: item.extensionId,
    title: item.contribution.title,
    icon: item.contribution.icon,
    modes: item.contribution.modes.map((mode) => normalizedRef(mode, item.extensionId)),
    placement: item.contribution.placement,
    command: commandRef(item.contribution.command, item.extensionId),
    params: item.contribution.params as Record<string, unknown> | undefined,
  })),
  settingsSections: input.runtime.settingsSections.map((section) => ({
    id: section.id,
    extensionId: section.extensionId,
    title: section.contribution.title,
    order: section.contribution.order,
  })),
  settingsPanels: input.runtime.settingsPanels.map((panel) => ({
    id: panel.id,
    extensionId: panel.extensionId,
    view: normalizedRef(panel.contribution.view, panel.extensionId),
    slot: panel.contribution.slot,
    section: panel.contribution.section ? normalizedRef(panel.contribution.section, panel.extensionId) : undefined,
  })),
  commandPaletteResources: compact(input.runtime.commandPaletteResources.map(toCommandPaletteResource)),
  keybindings: input.runtime.keybindings.map(toKeybindingRecord),
  settingsDefinitions: input.runtime.settings.map(toSettingDefinitionRecord),
  connections: input.runtime.connections.map((record) => ({
    id: record.id,
    localId: record.localId,
    extensionId: record.extensionId,
    label: record.contribution.label,
    authType: record.contribution.auth.type,
    supportsCheck: Boolean(record.contribution.check),
  })),
  diagnostics: [...input.runtime.diagnostics],
});
