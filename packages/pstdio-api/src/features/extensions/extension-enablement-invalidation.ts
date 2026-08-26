import type { EventBus } from "../sync/event-bus";
import type { ProjectExtensionRuntimeCatalog } from "./project-extension-runtime-catalog";

type SubscribeExtensionEnablementInvalidationInput = {
  eventBus: Pick<EventBus, "subscribe">;
  invalidate: ProjectExtensionRuntimeCatalog["invalidate"];
};

// Instance events carry their scope, including deletion events whose row has already
// been removed from storage. This keeps runtime invalidation project-local.
const projectIdOf = (data: unknown) => {
  if (typeof data !== "object" || data === null) return undefined;
  const row = data as { scope_type?: unknown; scope_id?: unknown };
  if (row.scope_type !== "project" || typeof row.scope_id !== "string") return undefined;
  return row.scope_id;
};

// Enabling, disabling, creating, or removing an extension instance changes which
// sources belong in a project's runtime snapshot, so the affected project must
// build a new generation on its next read.
export const subscribeExtensionEnablementInvalidation = (input: SubscribeExtensionEnablementInvalidationInput) =>
  input.eventBus.subscribe((event) => {
    if (event.table !== "extension_instances") return;
    input.invalidate({ projectId: projectIdOf(event.data), reason: "enablement_changed" });
  });
