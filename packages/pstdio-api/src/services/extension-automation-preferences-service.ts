import type { createExtensionAutomationPreferencesDBService } from "pstdio-db";
import type { EventBus } from "../features/sync/event-bus";

export const createExtensionAutomationPreferencesService = (deps: {
  db: ReturnType<typeof createExtensionAutomationPreferencesDBService>;
  eventBus: EventBus;
}) => {
  const set = async (input: Parameters<typeof deps.db.set>[0]) => {
    const preference = await deps.db.set(input);
    deps.eventBus.emit("extension_automation_preferences", "set", preference);
    return preference;
  };
  return { ...deps.db, set };
};
