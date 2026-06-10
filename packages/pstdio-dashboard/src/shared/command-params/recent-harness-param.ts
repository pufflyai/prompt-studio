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

interface AvailableHarness {
  id: string;
  availability?: { type: string };
}

// Prefer an installed harness; the menu renders NOT_FOUND agents as disabled, so
// picking one as the auto-selection would land on an unusable value.
const firstAvailableHarness = (agents: AvailableHarness[]) =>
  agents.find((agent) => agent.availability?.type !== "NOT_FOUND") ?? agents[0];

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

// A harness selector always commits a value: the explicit current selection, then
// the project's last-used harness, then the project default, then the first
// available harness. Only an empty harness list leaves the field unset.
export const resolveInitialHarnessSelection = (input: {
  current: CurrentHarnessSelection;
  recent: RecentHarnessSelection | undefined;
  defaultAgent: string | null | undefined;
  agents?: AvailableHarness[];
}) => {
  if (input.current.harnessId) return input.current;
  if (input.recent?.harnessId) return { harnessId: input.recent.harnessId, model: input.recent.model ?? "" };
  if (input.defaultAgent) return { harnessId: input.defaultAgent, model: "" };

  const fallback = firstAvailableHarness(input.agents ?? []);
  if (fallback) return { harnessId: fallback.id, model: "" };

  return input.current;
};
