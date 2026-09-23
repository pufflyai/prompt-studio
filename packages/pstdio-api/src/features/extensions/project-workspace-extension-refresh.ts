import type { EventBus } from "../sync/event-bus";
import type { ProjectExtensionRuntimeCatalog } from "./project-extension-runtime-catalog";

type RefreshInput = {
  eventBus: Pick<EventBus, "subscribe">;
  invalidate: ProjectExtensionRuntimeCatalog["invalidate"];
  onError?: (error: unknown) => void;
  refreshWatchers: () => Promise<void> | void;
};

export const subscribeProjectWorkspaceExtensionRefresh = (input: RefreshInput) =>
  input.eventBus.subscribe((event) => {
    if (event.table !== "workspaces") return;
    const row = event.data as Record<string, unknown>;
    // Project setup creates its files before extension watchers can load them.
    if (
      event.op === "set" &&
      (!row.is_default ||
        row.execution_kind !== "local" ||
        !row.root_path ||
        row.initializing ||
        row.setup_error ||
        row.provider_state !== "ready")
    )
      return;
    const projectId = typeof row.project_id === "string" ? row.project_id : undefined;
    input.invalidate({ projectId, reason: "project_workspace_changed" });
    Promise.resolve(input.refreshWatchers()).catch((error) => input.onError?.(error));
  });
