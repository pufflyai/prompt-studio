import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { resourceKey } from "@pstdio/sdk/extensions";
import { text } from "pstdio-extensions/workbench";
import type { Disposable, WorkbenchPanelTab, WorkbenchTabSnapshot } from "../../core";
import { toWorkbenchNavigationTargetResult } from "./extension-navigation-target";
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
const toSnapshot = (value: unknown, extensionId: string): WorkbenchTabSnapshot => {
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
              const target = toWorkbenchNavigationTargetResult(row.action, { extensionId });
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
  const loading = new Set<string>();
  const listeners = new Set<() => void>();
  const refreshEvents = new Set(metadata.refreshEventIds ?? []);
  const load = (instance: Parameters<WorkbenchPanelTab["getSnapshot"]>[0]) => {
    if (loading.has(instance.instanceId)) return;
    loading.add(instance.instanceId);
    const resource = instance.resource
      ? {
          type: instance.resource.type,
          id: instance.resource.id ?? resourceKey(instance.resource),
          label: instance.resource.label,
          metadata: instance.resource.metadata,
        }
      : undefined;
    void Promise.resolve(
      input.executeCommand(metadata.queryHandlerId, {
        projectId: input.projectId,
        source: "dashboard",
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
      .then((response) => {
        const value = isRecord(response) && isRecord(response.outcome) ? response.outcome.value : response;
        snapshots.set(instance.instanceId, toSnapshot(value, metadata.extensionId));
        for (const listener of listeners) listener();
      })
      .finally(() => loading.delete(instance.instanceId));
  };
  return {
    refreshEvents: metadata.refreshEventIds,
    getSnapshot(instance) {
      load(instance);
      return snapshots.get(instance.instanceId) ?? {};
    },
    subscribe(listener) {
      listeners.add(listener);
      const refreshSubscription = input.subscribeRefreshEvents?.((event: WorkbenchExtensionRefreshEvent) => {
        if (!refreshEvents.has(event.id)) return;
        snapshots.clear();
        listener();
      });
      const disposable: Disposable = {
        dispose() {
          listeners.delete(listener);
          refreshSubscription?.dispose();
        },
      };
      return disposable;
    },
  };
};
