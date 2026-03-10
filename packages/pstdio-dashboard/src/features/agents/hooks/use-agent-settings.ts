import { useSyncExternalStore } from "react";

const SETTINGS_PREFIX = "agent-settings:";

const readSettings = (agentId: string): Record<string, unknown> => {
  const raw = localStorage.getItem(`${SETTINGS_PREFIX}${agentId}`);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const writeSettings = (agentId: string, settings: Record<string, unknown>) => {
  localStorage.setItem(`${SETTINGS_PREFIX}${agentId}`, JSON.stringify(settings));
};

let version = 0;
const listeners = new Set<() => void>();
const notify = () => {
  version++;
  for (const l of listeners) l();
};

export const useAgentSettings = (agentId: string) => {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
  );

  void snapshot;
  return { data: readSettings(agentId), isLoading: false };
};

export const useUpdateAgentSettings = (agentId: string) => ({
  mutate: (settings: Record<string, unknown>) => {
    writeSettings(agentId, settings);
    notify();
  },
  mutateAsync: async (settings: Record<string, unknown>) => {
    writeSettings(agentId, settings);
    notify();
    return settings;
  },
  isPending: false,
  error: null,
});
