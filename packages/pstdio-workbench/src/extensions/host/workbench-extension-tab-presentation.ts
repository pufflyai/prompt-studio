import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { commandRefId, isNavigationTarget, resourceKey } from "@pstdio/sdk/extensions";
import { text } from "pstdio-extensions/workbench";
import type { Disposable, WorkbenchPanelTab, WorkbenchTabMenuList, WorkbenchTabSnapshot } from "../../core";
import { toWorkbenchNavigationTarget } from "./extension-navigation-target";
import { executeWorkbenchExtensionCommand } from "./workbench-extension-command";
import type { RegisterWorkbenchExtensionContributionsInput } from "./workbench-extension-host-types";
import type { WorkbenchExtensionRefreshEvent } from "./workbench-extension-refresh";

type MetadataPlacement = WorkbenchExtensionMetadata["placements"][number];
type MetadataPageSlot = WorkbenchExtensionMetadata["pages"][number]["slots"][number];
export type WorkbenchExtensionTabMetadata = NonNullable<MetadataPlacement["tab"] | MetadataPageSlot["tab"]> & {
  extensionId: string;
  placementId: string;
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
const navigationAction = (value: unknown, extensionId: string, projectId: string) =>
  isNavigationTarget(value) ? toWorkbenchNavigationTarget(value, { extensionId, projectId }) : undefined;
const toRows = (value: unknown, extensionId: string, projectId: string) =>
  Array.isArray(value)
    ? value.flatMap((row) => {
        if (!isRecord(row) || typeof row.id !== "string") return [];
        const target = navigationAction(row.action, extensionId, projectId);
        return [
          {
            id: row.id,
            label: text(row.label as Parameters<typeof text>[0], row.id),
            icon: typeof row.icon === "string" ? row.icon : undefined,
            iconColor: typeof row.iconColor === "string" ? row.iconColor : undefined,
            selected: row.selected === true,
            disabled: row.disabled === true,
            action: target ? { kind: "navigation" as const, target } : undefined,
          },
        ];
      })
    : [];
type LoadMenuPage = (
  commandId: string,
  request: Parameters<WorkbenchTabMenuList["loadPage"]>[0],
) => ReturnType<WorkbenchTabMenuList["loadPage"]>;
const toMenuList = (value: unknown, owner: string, loadPage: LoadMenuPage) => {
  if (!isRecord(value) || !isRecord(value.command) || typeof value.command.id !== "string") return undefined;
  const command = value.command;
  const id = commandRefId({
    id: command.id as string,
    extensionId: typeof command.extensionId === "string" ? command.extensionId : owner,
  });
  return {
    searchLabel: text(value.searchLabel as Parameters<typeof text>[0], "Search"),
    emptyLabel: text(value.emptyLabel as Parameters<typeof text>[0], "No results"),
    loadPage: (request: Parameters<WorkbenchTabMenuList["loadPage"]>[0]) => loadPage(id, request),
  };
};
const toSnapshot = (
  value: unknown,
  extensionId: string,
  projectId: string,
  loadPage: (
    commandId: string,
    request: Parameters<WorkbenchTabMenuList["loadPage"]>[0],
  ) => ReturnType<WorkbenchTabMenuList["loadPage"]>,
): WorkbenchTabSnapshot => {
  if (!isRecord(value)) return {};
  const indicator = isRecord(value.indicator)
    ? {
        icon: String(value.indicator.icon ?? ""),
        color: typeof value.indicator.color === "string" ? value.indicator.color : undefined,
        label: text(value.indicator.label as Parameters<typeof text>[0]),
      }
    : undefined;
  const menu = Array.isArray(value.menu)
    ? value.menu.flatMap((candidate) => {
        if (!isRecord(candidate) || typeof candidate.id !== "string" || !Array.isArray(candidate.rows)) return [];
        return [
          {
            id: candidate.id,
            label: text(candidate.label as Parameters<typeof text>[0]),
            rows: toRows(candidate.rows, extensionId, projectId),
            trailingRows: toRows(candidate.trailingRows, extensionId, projectId),
            list: toMenuList(candidate.list, extensionId, loadPage),
          },
        ];
      })
    : undefined;
  return {
    label: text(value.label as Parameters<typeof text>[0]),
    icon: typeof value.icon === "string" ? value.icon : undefined,
    indicator: indicator?.icon ? indicator : undefined,
    menu,
  };
};
export const createWorkbenchExtensionTabPresentation = (
  input: RegisterWorkbenchExtensionContributionsInput,
  metadata: WorkbenchExtensionTabMetadata,
): WorkbenchPanelTab => {
  const snapshots = new Map<string, WorkbenchTabSnapshot>();
  const instances = new Map<string, Parameters<WorkbenchPanelTab["getSnapshot"]>[0]>();
  const loading = new Map<string, Promise<void>>();
  const listeners = new Set<() => void>();
  const refreshEvents = new Set(metadata.refreshEventIds ?? []);
  let revision = 0;
  const load = (instance: Parameters<WorkbenchPanelTab["getSnapshot"]>[0]): Promise<void> => {
    instances.set(instance.instanceId, instance);
    const pending = loading.get(instance.instanceId);
    if (pending) return pending;
    const resource = instance.resource;
    const currentRevision = revision;
    const pendingLoad = Promise.resolve(
      executeWorkbenchExtensionCommand(input, metadata.queryHandlerId, {
        resource,
        params: {
          renderer: {
            rendererId: metadata.placementId,
            projectId: input.projectId,
            ...(resource ? { resource } : {}),
            invocation: { placement: "visible" },
          },
        },
      }),
    )
      .then(async (value) => {
        if (currentRevision !== revision) {
          loading.delete(instance.instanceId);
          await load(instance);
          return;
        }
        snapshots.set(
          instance.instanceId,
          toSnapshot(value, metadata.extensionId, input.projectId, async (commandId, request) => {
            const page = await executeWorkbenchExtensionCommand(input, commandId, {
              resource,
              params: { query: request.query, ...(request.cursor ? { cursor: request.cursor } : {}) },
              signal: request.signal,
            });
            if (!isRecord(page) || !Array.isArray(page.rows)) throw new Error("Invalid menu list page.");
            return {
              rows: toRows(page.rows, metadata.extensionId, input.projectId),
              nextCursor: typeof page.nextCursor === "string" ? page.nextCursor : undefined,
            };
          }),
        );
        for (const listener of listeners) listener();
      })
      .finally(() => {
        if (loading.get(instance.instanceId) === pendingLoad) loading.delete(instance.instanceId);
      });
    loading.set(instance.instanceId, pendingLoad);
    return pendingLoad;
  };
  return {
    refreshEvents: metadata.refreshEventIds,
    getSnapshot(instance) {
      if (!snapshots.has(instance.instanceId)) void load(instance).catch(() => undefined);
      return snapshots.get(instance.instanceId) ?? {};
    },
    subscribe(listener) {
      listeners.add(listener);
      const resourceSubscription = input.workbench.resources.preview.subscribeRefresh(async (resource) => {
        const affected = [...instances.values()].filter(
          (instance) => instance.resource && resourceKey(instance.resource) === resourceKey(resource),
        );
        if (!affected.length) return;
        revision++;
        await Promise.all(affected.map(load));
      });
      const refreshSubscription = input.subscribeRefreshEvents?.((event: WorkbenchExtensionRefreshEvent) => {
        if (!refreshEvents.has(event.id)) return;
        revision++;
        for (const instance of instances.values()) void load(instance).catch(() => undefined);
      });
      const disposable: Disposable = {
        dispose() {
          listeners.delete(listener);
          refreshSubscription?.dispose();
          resourceSubscription.dispose();
        },
      };
      return disposable;
    },
  };
};
