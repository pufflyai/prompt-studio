import type { QueryChangeEnvelope } from "pstdio-api-contracts/extension-kernel";
import { contributionAliases, type ExtensionRuntime } from "pstdio-extensions";
import type { EventBus } from "../sync/event-bus";

/** Guest notification compatibility never dispatches an event or invokes a hook again. */
export const publishExtensionEventNotifications = (
  eventBus: EventBus,
  runtime: ExtensionRuntime,
  eventId: string,
  refresh: QueryChangeEnvelope,
  includeCanonical = true,
) => {
  const ids = new Set(includeCanonical ? [eventId] : []);
  for (const [previous, canonical] of contributionAliases(runtime)) if (canonical === eventId) ids.add(previous);
  for (const id of ids) eventBus.emit("extension_events", "set", { ...refresh, id: crypto.randomUUID(), eventId: id });
};
