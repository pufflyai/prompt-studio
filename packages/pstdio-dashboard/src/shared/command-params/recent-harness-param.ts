export interface RecentHarnessStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export interface RecentHarnessSetup {
  model?: string;
  params?: Record<string, string | boolean>;
}

export interface RecentHarnessSelection extends RecentHarnessSetup {
  harnessId: string;
  /** Last setup for every harness used in the project, not just the last one. */
  harnesses?: Record<string, RecentHarnessSetup>;
}

export interface ResolvedHarnessSelection {
  harnessId: string;
  model: string;
  params?: Record<string, string | boolean>;
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

const filterParams = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value).filter(([, entry]) => typeof entry === "string" || typeof entry === "boolean");
  return entries.length > 0 ? (Object.fromEntries(entries) as Record<string, string | boolean>) : undefined;
};

const parseSetup = (value: unknown): RecentHarnessSetup | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const model = typeof record.model === "string" && record.model.length > 0 ? record.model : undefined;
  const params = filterParams(record.params);
  return model || params ? { ...(model ? { model } : {}), ...(params ? { params } : {}) } : undefined;
};

const setupFromSelection = (selection: RecentHarnessSelection): RecentHarnessSetup | undefined => {
  const model = selection.model?.trim();
  const params = filterParams(selection.params);
  return model || params ? { ...(model ? { model } : {}), ...(params ? { params } : {}) } : undefined;
};

const parseHarnesses = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value).flatMap(([harnessId, setup]) => {
    const parsed = parseSetup(setup);
    return harnessId && parsed ? [[harnessId, parsed] as const] : [];
  });
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

export const readRecentHarnessSelection = (projectId: string | undefined, storage?: RecentHarnessStorage) => {
  const resolvedStorage = resolveStorage(storage);
  if (!projectId || !resolvedStorage) return undefined;

  const raw = resolvedStorage.getItem(storageKey(projectId));
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.harnessId !== "string" || parsed.harnessId.length === 0) return undefined;
    const harnesses = parseHarnesses(parsed.harnesses);
    return {
      harnessId: parsed.harnessId,
      ...(parseSetup(parsed) ?? {}),
      ...(harnesses ? { harnesses } : {}),
    } satisfies RecentHarnessSelection;
  } catch {
    return undefined;
  }
};

const setupFor = (recent: RecentHarnessSelection | undefined, harnessId: string) => {
  if (!recent) return undefined;
  const saved = recent.harnesses?.[harnessId];
  if (saved) return saved;
  return recent.harnessId === harnessId ? setupFromSelection(recent) : undefined;
};

export const readRecentHarnessSetup = (
  projectId: string | undefined,
  harnessId: string,
  storage?: RecentHarnessStorage,
) => setupFor(readRecentHarnessSelection(projectId, storage), harnessId);

export const saveRecentHarnessSelection = (
  projectId: string | undefined,
  selection: RecentHarnessSelection,
  storage?: RecentHarnessStorage,
) => {
  const resolvedStorage = resolveStorage(storage);
  if (!projectId || !resolvedStorage || !selection.harnessId) return;

  const recent = readRecentHarnessSelection(projectId, resolvedStorage);
  const previous = setupFor(recent, selection.harnessId);
  const hasModel = Object.hasOwn(selection, "model");
  const hasParams = Object.hasOwn(selection, "params");
  const next: RecentHarnessSetup = {
    ...(previous ?? {}),
    ...(hasModel ? { model: selection.model } : {}),
    ...(hasParams ? { params: selection.params } : {}),
  };
  const setup = setupFromSelection({ harnessId: selection.harnessId, ...next });
  const harnesses = { ...(recent?.harnesses ?? {}) };
  // Carry a legacy single-harness entry into the per-harness map before adding another harness.
  if (recent && !harnesses[recent.harnessId]) {
    const legacy = setupFromSelection(recent);
    if (legacy) harnesses[recent.harnessId] = legacy;
  }
  if (setup) harnesses[selection.harnessId] = setup;
  else delete harnesses[selection.harnessId];

  resolvedStorage.setItem(
    storageKey(projectId),
    JSON.stringify({
      harnessId: selection.harnessId,
      ...(setup ?? {}),
      ...(Object.keys(harnesses).length > 0 ? { harnesses } : {}),
    }),
  );
};

// A harness selector always commits a value: the explicit current selection, then
// the project's last-used harness, then the project default, then the first
// available harness. Only an empty harness list leaves the field unset.
export const resolveInitialHarnessSelection = (input: {
  current: CurrentHarnessSelection;
  recent: RecentHarnessSelection | undefined;
  defaultAgent: string | null | undefined;
  agents?: AvailableHarness[];
}): ResolvedHarnessSelection => {
  const restore = (harnessId: string) => {
    const setup = setupFor(input.recent, harnessId);
    const model = setup?.model ?? "";
    // Parameters only make sense with the model that was saved alongside them.
    return { harnessId, model, ...(model && setup?.params ? { params: setup.params } : {}) };
  };

  // Existing selections belong to the live field, including a model cleared by catalog synchronization.
  // Explicit harness switches restore their setup in the selection handler.
  if (input.current.harnessId) return input.current;
  if (input.recent?.harnessId) return restore(input.recent.harnessId);
  if (input.defaultAgent) return restore(input.defaultAgent);

  const fallback = firstAvailableHarness(input.agents ?? []);
  if (fallback) return restore(fallback.id);

  return input.current;
};
