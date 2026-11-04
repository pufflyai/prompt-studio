import { viewDataEvents } from "@pstdio/sdk/extensions";
import { getRuntimeCollections } from "@/lib/sync/collections";
import {
  type ExtensionRefreshEvent,
  publishExtensionEvent,
  subscribeToExtensionEventFeed,
} from "./extension-webview-broadcast";
import { subscribeToResourceRemovals } from "./resource-removal-feed";
import { subscribeDashboardExtensionMetadata } from "./workbench-extension-contributions";

export const subscribeResourceViewDataEvents = (input: {
  projectId(): string | undefined;
  refreshEventIds(): readonly string[];
  publish?(event: ExtensionRefreshEvent): void;
}) => {
  const owner = getRuntimeCollections();
  const projects = new Set<string>();
  let scheduled = false;
  let disposed = false;
  const enqueue = (projectId: string | undefined) => {
    if (!projectId) return;
    projects.add(projectId);
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (disposed || owner.isDisposed()) return;
      const pending = [...projects];
      projects.clear();
      for (const projectId of pending) {
        const event = { id: viewDataEvents.resourcesChanged.id, projectId };
        if (input.publish) input.publish(event);
        else publishExtensionEvent(event, owner);
      }
    });
  };
  const stops = [
    subscribeToExtensionEventFeed((event) => {
      if (event.id !== viewDataEvents.resourcesChanged.id && input.refreshEventIds().includes(event.id))
        enqueue(event.projectId);
    }, owner),
    subscribeToResourceRemovals((resource) => enqueue(resource.projectId), owner),
    subscribeDashboardExtensionMetadata(() => enqueue(input.projectId()), owner),
    owner.subscribeCollections((change) => {
      if (!change || !["workspaces", "sessions", "projects"].includes(change.table)) return;
      for (const { value, previousValue } of change.changes) {
        for (const row of [previousValue, value]) {
          const projectId = change.table === "projects" ? row?.id : row?.project_id;
          if (typeof projectId === "string") enqueue(projectId);
        }
      }
    }),
  ];
  return () => {
    disposed = true;
    projects.clear();
    for (const stop of stops) stop();
  };
};
