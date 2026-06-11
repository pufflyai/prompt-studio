import type { WorkbenchExtensionCommandPaletteResourceRecord } from "@pstdio/sdk/api";
import { text } from "pstdio-extensions/workbench";
import type { CommandPaletteResourceResult, Disposable } from "../../core";
import type { WorkbenchExtensionCommandContext } from "../host/workbench-extension-command";
import {
  executeWorkbenchExtensionCommand,
  toExtensionCommandResource,
  toWorkbenchResource,
} from "../host/workbench-extension-command";

// Transport-safe shapes returned by an extension queryCommand.
interface ResourceItemTarget {
  kind: "command" | "resource";
  command?: string | { id: string };
  params?: Record<string, unknown>;
  resource?: Parameters<typeof toWorkbenchResource>[0];
}

interface ResourceItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  keywords?: string[];
  target: ResourceItemTarget;
}

interface ProviderQueryResult {
  items?: ResourceItem[];
}

const isProviderQueryResult = (value: unknown): value is ProviderQueryResult =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const commandIdOf = (command: ResourceItemTarget["command"]) => (typeof command === "string" ? command : command?.id);

const activateTarget = async (context: WorkbenchExtensionCommandContext, target: ResourceItemTarget) => {
  if (target.kind === "resource" && target.resource) {
    await context.workbench.resources.openResource(toWorkbenchResource(target.resource)).catch(() => undefined);
    return;
  }

  const commandId = commandIdOf(target.command);
  if (!commandId) return;
  await executeWorkbenchExtensionCommand(context, commandId, { params: target.params });
  // A selected command may mutate extension data; refresh providers so a reopened
  // palette reflects the change without an app reload.
  context.workbench.commandPaletteResources.refresh();
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
  activate: () => activateTarget(context, item.target),
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
