import type { UpdateSettingsInput } from "pstdio-api-contracts";
import type { createSettingsDBService } from "pstdio-db";

import type { EventBus } from "../features/sync/event-bus";

export type SettingsServiceDeps = {
  eventBus: EventBus;
  settingsDb: ReturnType<typeof createSettingsDBService>;
  onCapacityAvailable?: () => Promise<void>;
};

export const createSettingsService = (deps: SettingsServiceDeps) => {
  const get = async () => {
    const settings = await deps.settingsDb.get();
    return {
      max_concurrent_sessions: settings.max_concurrent_sessions,
      notifications_enabled: settings.notifications_enabled,
    };
  };

  const update = async (input: UpdateSettingsInput) => {
    const settings = await deps.settingsDb.update(input);
    deps.eventBus.emit("settings", "set", settings);
    if ("max_concurrent_sessions" in input) await deps.onCapacityAvailable?.();
    return {
      max_concurrent_sessions: settings.max_concurrent_sessions,
      notifications_enabled: settings.notifications_enabled,
    };
  };

  return { get, update };
};
