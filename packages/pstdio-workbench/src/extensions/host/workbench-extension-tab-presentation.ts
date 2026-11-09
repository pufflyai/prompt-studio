import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import {
  createScopedQueryClient,
  isNavigationTarget,
  resourceKey,
  type ScopedQuery,
  viewDataEvents,
} from "@pstdio/sdk/extensions";
import { text } from "pstdio-extensions/workbench";
import type { Disposable, WorkbenchPanelTab, WorkbenchTabSnapshot } from "../../core";
import { toWorkbenchNavigationTarget } from "./extension-navigation-target";
import { executeWorkbenchExtensionCommand } from "./workbench-extension-command";
import type { RegisterWorkbenchExtensionContributionsInput } from "./workbench-extension-host-types";

type MetadataPlacement = WorkbenchExtensionMetadata["placements"][number];
type MetadataPageSlot = WorkbenchExtensionMetadata["pages"][number]["slots"][number];
export type WorkbenchExtensionTabMetadata = NonNullable<MetadataPlacement["tab"] | MetadataPageSlot["tab"]> & {
  extensionId: string;
  placementId: string;
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
const navigationAction = (value: unknown, extensionId: string, projectId?: string) =>
  isNavigationTarget(value) ? toWorkbenchNavigationTarget(value, { extensionId, projectId }) : undefined;
const toRows = (value: unknown, extensionId: string, projectId?: string) =>
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
export const toWorkbenchPresentationSnapshot = (
  value: unknown,
  extensionId: string,
  projectId?: string,
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
): WorkbenchPanelTab & Disposable => {
  const root =
    input.queries ??
    createScopedQueryClient(
      { runtimeId: "workbench", projectId: input.projectId, extensionId: metadata.extensionId },
      {
        subscribe: (invalidate) => {
          const events = input.subscribeRefreshEvents?.((event) => invalidate({ ...event, type: "changed" }));
          const resets = input.subscribeRefreshReset?.((event) => invalidate({ ...event, type: "reset" }));
          return () => {
            events?.dispose();
            resets?.dispose();
          };
        },
      },
    );
  const scoped = root.forScope({ projectId: input.projectId, extensionId: metadata.extensionId });
  const queries = new Map<string, ScopedQuery<WorkbenchTabSnapshot>>();
  const legacy = new Map<() => void, Map<string, () => void>>();
  const releases = new Set<() => void>();
  let disposed = false;
  const empty: WorkbenchTabSnapshot = {};
  const observe = (query: ScopedQuery<WorkbenchTabSnapshot>, listener: () => void) => {
    let previous = query.getSnapshot().data;
    return query.subscribe(() => {
      const next = query.getSnapshot().data;
      if (previous === next) return;
      previous = next;
      listener();
    });
  };
  const queryFor = (instance: Parameters<WorkbenchPanelTab["getSnapshot"]>[0]) => {
    const resource = instance.resource;
    const key = resourceKey(resource) ?? "unbound";
    let query = queries.get(key);
    if (!query || query.isDisposed()) {
      query = scoped.query({
        id: `tab:${metadata.placementId}:${metadata.queryHandlerId}`,
        resourceKey: key,
        params: input.presentationLocale,
        dependsOn: [
          viewDataEvents.extensionCatalogChanged.id,
          viewDataEvents.extensionTranslationsChanged.id,
          ...(metadata.refreshEventIds ?? []),
        ],
        dependency: { resourceKey: resourceKey(resource), resourceId: resource?.id },
        read: async (signal) =>
          toWorkbenchPresentationSnapshot(
            await executeWorkbenchExtensionCommand(input, metadata.queryHandlerId, {
              resource,
              signal,
              params: {
                renderer: {
                  rendererId: metadata.placementId,
                  projectId: input.projectId,
                  ...(resource ? { resource } : {}),
                  invocation: { placement: "visible" },
                },
              },
            }),
            metadata.extensionId,
            input.projectId,
          ),
      });
      queries.set(key, query);
      for (const [listener, bindings] of legacy) bindings.set(key, observe(query, listener));
      for (const [oldKey, old] of queries)
        if (oldKey !== key && queries.size > 128 && !old.active()) queries.delete(oldKey);
    }
    return query;
  };
  const preview = input.workbench.resources.preview.subscribeRefresh(async (resource) => {
    const query = queries.get(resourceKey(resource)!);
    if (!query) return;
    await query.refreshObserved();
  });
  return {
    refreshEvents: metadata.refreshEventIds,
    isDisposed: () => disposed,
    getSnapshot(instance) {
      if (disposed) return empty;
      const query = queryFor(instance);
      const state = query.getSnapshot();
      return state.data ?? empty;
    },
    subscribe(listener, instance) {
      if (disposed) return { dispose() {} };
      let stop: () => void;
      if (instance) stop = observe(queryFor(instance), listener);
      else {
        const bindings = new Map([...queries].map(([key, query]) => [key, observe(query, listener)]));
        legacy.set(listener, bindings);
        stop = () => {
          legacy.delete(listener);
          for (const release of bindings.values()) release();
          bindings.clear();
        };
      }
      const release = () => {
        releases.delete(release);
        stop();
      };
      releases.add(release);
      return { dispose: release };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const release of releases) release();
      preview.dispose();
      legacy.clear();
      queries.clear();
      if (!input.queries) root.dispose();
    },
  };
};
