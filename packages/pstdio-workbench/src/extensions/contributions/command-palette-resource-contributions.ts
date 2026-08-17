import type { WorkbenchExtensionCommandPaletteResourceRecord } from "@pstdio/sdk/api";
import type { ExtensionNavigationTarget } from "@pstdio/sdk/extensions";
import { text } from "pstdio-extensions/workbench";
import type { CommandPaletteResourceResult, Disposable } from "../../core";
import { FILE_SECTION_NAVIGATION_METADATA_KEY } from "../../core/registries/renderers/file-section-navigation";
import { toWorkbenchNavigationTarget } from "../host/extension-navigation-target";
import type { WorkbenchExtensionCommandContext } from "../host/workbench-extension-command";
import {
  executeWorkbenchExtensionCommand,
  toExtensionCommandResource,
  toWorkbenchResource,
} from "../host/workbench-extension-command";

interface ResourceItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  keywords?: string[];
  target: ExtensionNavigationTarget;
}

interface ProviderQueryResult {
  items?: ResourceItem[];
}

const isProviderQueryResult = (value: unknown): value is ProviderQueryResult =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const commandIdOf = (command: Extract<ExtensionNavigationTarget, { kind: "command" }>["command"]) =>
  typeof command === "string" ? command : command.id;

const activateTarget = async (
  context: WorkbenchExtensionCommandContext,
  record: WorkbenchExtensionCommandPaletteResourceRecord,
  item: ResourceItem,
) => {
  const { target } = item;
  if (target.kind === "command") {
    await executeWorkbenchExtensionCommand(context, commandIdOf(target.command), { params: target.params });
    // A selected command may mutate extension data; refresh providers so a reopened
    // palette reflects the change without an app reload.
    context.workbench.commandPaletteResources.refresh();
    return;
  }

  await context.workbench.navigation.openTarget(
    toWorkbenchNavigationTarget(target, {
      resourceOf: (resource, resourceTarget) => {
        const resolved = toWorkbenchResource(resource);
        if (!resourceTarget.section) return resolved;
        return {
          ...resolved,
          metadata: {
            ...resolved.metadata,
            [FILE_SECTION_NAVIGATION_METADATA_KEY]: {
              treeId: record.id,
              targetNodeId: item.id,
              anchors: resourceTarget.section.anchors,
            },
          },
        };
      },
    }),
  );
};

const toResult = (
  context: WorkbenchExtensionCommandContext,
  record: WorkbenchExtensionCommandPaletteResourceRecord,
  groupLabel: string,
  item: ResourceItem,
): CommandPaletteResourceResult => ({
  id: `${record.id}:${item.id}`,
  label: item.label,
  description: item.description,
  icon: item.icon,
  keywords: item.keywords,
  group: groupLabel,
  activate: () => activateTarget(context, record, item),
});

export const registerWorkbenchExtensionCommandPaletteResources = (
  context: WorkbenchExtensionCommandContext,
  records: readonly WorkbenchExtensionCommandPaletteResourceRecord[],
) => {
  const disposables: Disposable[] = [];

  for (const record of records) {
    const groupLabel = text(record.title, record.id);
    disposables.push(
      context.workbench.commandPaletteResources.registerProvider({
        id: record.id,
        title: groupLabel,
        refreshEventIds: record.refreshEventIds,
        query: async ({ query, limit }) => {
          const activeResource = context.workbench.getActiveResource();
          const value = await executeWorkbenchExtensionCommand(context, record.queryCommandId, {
            params: {
              projectId: context.projectId,
              modeId: context.workbench.modes.getActiveModeId(),
              activeResource: toExtensionCommandResource(activeResource),
              providerId: record.id,
              query,
              limit,
            },
          });
          if (!isProviderQueryResult(value)) return [];
          return (value.items ?? []).map((item) => toResult(context, record, groupLabel, item));
        },
      }),
    );
  }

  return {
    dispose() {
      for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index]?.dispose();
    },
  };
};
