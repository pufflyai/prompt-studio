import type { UpdateSettingsInput } from "pstdio-api-contracts";
import type { createSettingsDBService } from "pstdio-db";

export type SettingsServiceDeps = {
  settingsDb: ReturnType<typeof createSettingsDBService>;
};

export const createSettingsService = (deps: SettingsServiceDeps) => {
  const get = async () => {
    const settings = await deps.settingsDb.get();
    return { max_concurrent_sessions: settings.max_concurrent_sessions };
  };

  const update = async (input: UpdateSettingsInput) => {
    const settings = await deps.settingsDb.update(input);
    return { max_concurrent_sessions: settings.max_concurrent_sessions };
  };

  return { get, update };
};
