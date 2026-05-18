import { createDisposable, type Disposable } from "../../shared/disposable";
import type { WorkbenchCollectionScope } from "../favorites/favorite-registry";
import type {
  CreateSavedViewInput,
  FilterExpression,
  SavedViewKindContribution,
  SavedViewListInput,
  UpdateSavedViewInput,
  ViewDisplayOptions,
  WorkbenchSavedView,
} from "./saved-view-types";
import { validateSavedViewDisplay, validateSavedViewFilterAgainstFields } from "./saved-view-validation";

export type {
  CreateSavedViewInput,
  FilterExpression,
  ResolvedSavedViewQuery,
  ResolveSavedViewQueryInput,
  SavedViewField,
  SavedViewFilterOperator,
  SavedViewKindContribution,
  SavedViewListInput,
  UpdateSavedViewInput,
  ValidationResult,
  ViewDisplayLayout,
  ViewDisplayOptions,
  WorkbenchSavedView,
} from "./saved-view-types";
export { validateSavedViewFilterAgainstFields } from "./saved-view-validation";

export type SavedViewChangeListener = () => void;

export interface SavedViewPersistenceAdapter {
  list(input?: SavedViewListInput): Promise<WorkbenchSavedView[]>;
  get(id: string): Promise<WorkbenchSavedView | undefined>;
  create(
    input: CreateSavedViewInput & { id: string; schemaVersion: number; createdAt: string; updatedAt: string },
  ): Promise<WorkbenchSavedView>;
  update(
    id: string,
    patch: UpdateSavedViewInput & { updatedAt: string; schemaVersion?: number },
  ): Promise<WorkbenchSavedView>;
  delete(id: string): Promise<void>;
}

export interface CreateSavedViewRegistryInput {
  persistence?: SavedViewPersistenceAdapter;
}

export interface SavedViewRegistry {
  registerKind(kind: SavedViewKindContribution): Disposable;
  getKind(kind: string): SavedViewKindContribution | undefined;
  listKinds(): SavedViewKindContribution[];
  list(input?: SavedViewListInput): Promise<WorkbenchSavedView[]>;
  get(id: string): Promise<WorkbenchSavedView | undefined>;
  create(input: CreateSavedViewInput): Promise<WorkbenchSavedView>;
  update(id: string, patch: UpdateSavedViewInput): Promise<WorkbenchSavedView>;
  duplicate(id: string, input?: { name?: string }): Promise<WorkbenchSavedView>;
  delete(id: string): Promise<void>;
  refresh(): void;
  notifyExternalChange(): void;
  onDidChange(listener: SavedViewChangeListener): Disposable;
}

const assertProjectScope = (input: { scope: WorkbenchCollectionScope; projectId?: string }) => {
  if (input.scope === "project" && !input.projectId) throw new Error("Project scope requires projectId");
};

const matchesListInput = (view: WorkbenchSavedView, input: SavedViewListInput = {}) => {
  if (input.scope && view.scope !== input.scope) return false;
  if (input.projectId && view.projectId !== input.projectId) return false;
  if (input.resourceKind && view.resourceKind !== input.resourceKind) return false;
  return true;
};

const createMemorySavedViewPersistence = () => {
  const views = new Map<string, WorkbenchSavedView>();

  return {
    async list(input = {}) {
      return [...views.values()]
        .filter((view) => matchesListInput(view, input))
        .sort((left, right) => (left.order ?? 0) - (right.order ?? 0) || left.createdAt.localeCompare(right.createdAt));
    },

    async get(id) {
      return views.get(id);
    },

    async create(input) {
      const view = { ...input };
      views.set(view.id, view);
      return view;
    },

    async update(id, patch) {
      const view = views.get(id);
      if (!view) throw new Error(`Saved view not found: ${id}`);
      const next = { ...view, ...patch };
      views.set(id, next);
      return next;
    },

    async delete(id) {
      views.delete(id);
    },
  } satisfies SavedViewPersistenceAdapter;
};

export const createSavedViewRegistry = (input: CreateSavedViewRegistryInput = {}): SavedViewRegistry => {
  const kinds = new Map<string, SavedViewKindContribution>();
  const persistence = input.persistence ?? createMemorySavedViewPersistence();
  const listeners = new Set<SavedViewChangeListener>();
  let idCounter = 0;

  const emitChange = () => {
    for (const listener of listeners) listener();
  };

  const requireKind = (resourceKind: string) => {
    const kind = kinds.get(resourceKind);
    if (!kind) throw new Error(`Saved view kind not registered: ${resourceKind}`);
    return kind;
  };

  const validateForWrite = (view: { resourceKind: string; filter: FilterExpression; display: ViewDisplayOptions }) => {
    const kind = requireKind(view.resourceKind);
    const filterResult = kind.validateFilter
      ? kind.validateFilter.call(kind, view.filter)
      : validateSavedViewFilterAgainstFields(view.filter, kind.fields);
    if (!filterResult.valid) throw new Error("Saved view filter is invalid");
    if (!validateSavedViewDisplay(view.display, kind).valid) throw new Error("Saved view display is invalid");
    return kind;
  };

  const resolveView = (view: WorkbenchSavedView): WorkbenchSavedView => {
    const kind = kinds.get(view.resourceKind);
    if (!kind) return { ...view, invalid: "kind" };
    const currentSchemaVersion = kind.currentSchemaVersion ?? 1;
    const migrated =
      view.schemaVersion < currentSchemaVersion
        ? (() => {
            try {
              return kind.migrate ? kind.migrate(view) : { ...view, schemaVersion: currentSchemaVersion };
            } catch {
              return { ...view, invalid: "migration" as const };
            }
          })()
        : view;
    if (migrated.invalid) return migrated;
    const filterResult = kind.validateFilter
      ? kind.validateFilter.call(kind, migrated.filter)
      : validateSavedViewFilterAgainstFields(migrated.filter, kind.fields);
    if (!filterResult.valid) return { ...migrated, invalid: "filter" };
    if (!validateSavedViewDisplay(migrated.display, kind).valid) return { ...migrated, invalid: "display" };
    return migrated;
  };

  const nextOrder = async (input: Pick<CreateSavedViewInput, "scope" | "projectId" | "resourceKind">) => {
    const scoped = await persistence.list(input);
    return scoped.reduce((max, view) => Math.max(max, view.order ?? 0), -1) + 1;
  };

  const nextSavedViewId = async () => {
    let viewId = "";

    do {
      idCounter += 1;
      viewId = `saved-view-${idCounter}`;
    } while (await persistence.get(viewId));

    return viewId;
  };

  return {
    registerKind(kind) {
      if (kinds.has(kind.kind)) throw new Error(`Saved view kind already registered: ${kind.kind}`);
      if (!kind.layouts.includes(kind.defaultDisplay.layout)) {
        throw new Error("Saved view display is invalid");
      }
      kinds.set(kind.kind, kind);
      emitChange();
      return createDisposable(() => {
        if (kinds.get(kind.kind) !== kind) return;
        kinds.delete(kind.kind);
        emitChange();
      });
    },

    getKind(kind) {
      return kinds.get(kind);
    },

    listKinds() {
      return [...kinds.values()].sort((left, right) => left.kind.localeCompare(right.kind));
    },

    async list(listInput = {}) {
      return (await persistence.list(listInput)).map(resolveView);
    },

    async get(id) {
      const view = await persistence.get(id);
      return view ? resolveView(view) : undefined;
    },

    async create(createInput) {
      assertProjectScope(createInput);
      const kind = validateForWrite(createInput);
      const timestamp = new Date().toISOString();
      const view = await persistence.create({
        ...createInput,
        id: await nextSavedViewId(),
        order: createInput.order ?? (await nextOrder(createInput)),
        schemaVersion: kind.currentSchemaVersion ?? 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      emitChange();
      return view;
    },

    async update(id, patch) {
      const existing = await persistence.get(id);
      if (!existing) throw new Error(`Saved view not found: ${id}`);
      const candidate = { ...existing, ...patch };
      validateForWrite(candidate);
      const updated = await persistence.update(id, { ...patch, updatedAt: new Date().toISOString() });
      emitChange();
      return updated;
    },

    async duplicate(id, duplicateInput = {}) {
      const existing = await persistence.get(id);
      if (!existing) throw new Error(`Saved view not found: ${id}`);
      return await this.create({
        name: duplicateInput.name ?? `${existing.name} Copy`,
        description: existing.description,
        resourceKind: existing.resourceKind,
        filter: existing.filter,
        display: existing.display,
        scope: existing.scope,
        projectId: existing.projectId,
      });
    },

    async delete(id) {
      if (!(await persistence.get(id))) throw new Error(`Saved view not found: ${id}`);
      await persistence.delete(id);
      emitChange();
    },

    refresh: emitChange,

    notifyExternalChange: emitChange,

    onDidChange(listener) {
      listeners.add(listener);
      return createDisposable(() => {
        listeners.delete(listener);
      });
    },
  };
};
