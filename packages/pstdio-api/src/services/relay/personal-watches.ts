import type { StorageOwner } from "pstdio-sync";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";

/** Storage commits affect progress; preview-only patches do not wake durable synchronization. */
export const watchPersonalHistory = (input: {
  deps: ExtensionsRouteDeps;
  owner: StorageOwner;
  announcing: () => boolean;
  ownsSession: (id: string) => boolean;
  preview: (id: string) => void;
  indexChanged: (id?: string) => void;
  conversationChanged: (id: string) => void;
  statusChanged?: () => void;
}) => {
  const { deps, owner } = input;
  const lookups = new Set<Promise<void>>();
  let stopped = false;
  const stopIndex = deps.eventBus.subscribe((event) => {
    if (input.announcing() || !["sessions", "workspaces", "workspace_sessions"].includes(event.table)) return;
    const row = event.data as { id?: string; project_id?: string };
    if (row.project_id && row.project_id !== owner.workbenchId) return;
    input.indexChanged(event.table === "sessions" ? row.id : undefined);
  });
  const stopConversations = deps.sessionService.store.watch((id, patch) => {
    if (patch?.path === "/approval_requests") {
      if (input.ownsSession(id)) input.indexChanged(id);
      else {
        // First capture may have read the approval snapshot before admitting this session.
        const lookup = deps.sessionService.get(id).then(
          (session) => {
            if (!stopped && session?.project_id === owner.workbenchId) input.indexChanged(id);
          },
          () => {
            if (!stopped) input.indexChanged();
          },
        );
        lookups.add(lookup);
        const release = () => lookups.delete(lookup);
        void lookup.then(release, release);
      }
      return;
    }
    if (!input.ownsSession(id)) return;
    input.preview(id);
    const count = deps.sessionService.store.get(id)?.conversation?.messageCount ?? 0;
    if (patch?.op === "replace" && patch.path === `/messages/${count - 1}`) return;
    input.conversationChanged(id);
  });
  const stopStorage = deps.extensionStorageService.watch((changed) => {
    if (changed.workbenchId === owner.workbenchId && changed.extensionId === owner.extensionId) input.statusChanged?.();
  });
  return async () => {
    stopped = true;
    stopIndex();
    stopConversations();
    stopStorage();
    await Promise.allSettled(lookups);
  };
};
