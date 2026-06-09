interface RecentHarnessStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export interface RecentHarnessSelection {
  harnessId: string;
  model?: string;
}

interface CurrentHarnessSelection {
  harnessId: string;
  model: string;
}

const storageKey = (projectId: string) => `pstdio-dashboard:command-params:recent-harness:${projectId}`;

const readStorage = () => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

export const createMemoryRecentHarnessStorage = () => {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  } satisfies RecentHarnessStorage;
};

const resolveStorage = (storage: RecentHarnessStorage | undefined) => storage ?? readStorage();

export const readRecentHarnessSelection = (projectId: string | undefined, storage?: RecentHarnessStorage) => {
  const resolvedStorage = resolveStorage(storage);
  if (!projectId || !resolvedStorage) return undefined;

  const raw = resolvedStorage.getItem(storageKey(projectId));
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.harnessId !== "string" || parsed.harnessId.length === 0) return undefined;
    return {
      harnessId: parsed.harnessId,
      ...(typeof parsed.model === "string" && parsed.model.length > 0 ? { model: parsed.model } : {}),
    };
  } catch {
    return undefined;
  }
};

export const saveRecentHarnessSelection = (
  projectId: string | undefined,
  selection: RecentHarnessSelection,
  storage?: RecentHarnessStorage,
) => {
  const resolvedStorage = resolveStorage(storage);
  if (!projectId || !resolvedStorage || !selection.harnessId) return;

  resolvedStorage.setItem(storageKey(projectId), JSON.stringify(selection));
};

export const resolveInitialHarnessSelection = (input: {
  current: CurrentHarnessSelection;
  recent: RecentHarnessSelection | undefined;
  defaultAgent: string | null | undefined;
}) => {
  if (input.current.harnessId) return input.current;
  if (input.recent?.harnessId) return { harnessId: input.recent.harnessId, model: input.recent.model ?? "" };
  if (input.defaultAgent) return { harnessId: input.defaultAgent, model: "" };
  return input.current;
};
