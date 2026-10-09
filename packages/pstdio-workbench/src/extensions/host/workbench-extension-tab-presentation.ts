import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { isNavigationTarget, resourceKey } from "@pstdio/sdk/extensions";
import { text } from "pstdio-extensions/workbench";
import type { Disposable, WorkbenchPanelTab, WorkbenchTabSnapshot } from "../../core";
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
const toSnapshot = (value: unknown, extensionId: string, projectId: string): WorkbenchTabSnapshot => {
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
            rows: candidate.rows.flatMap((row) => {
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
            }),
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
        snapshots.set(instance.instanceId, toSnapshot(value, metadata.extensionId, input.projectId));
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
