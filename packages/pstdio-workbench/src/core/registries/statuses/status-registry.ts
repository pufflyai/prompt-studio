import {
  byContributionPriority,
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";

export interface WorkflowStatus {
  id: string;
  label: string;
  color: string;
  icon?: string | null;
  sortOrder: number;
  isDefault?: boolean;
  actions?: readonly string[];
}

export interface WorkflowStatusAction {
  id: string;
  label: string;
  icon?: string;
}

export interface WorkbenchStatusSetContribution {
  id: string;
  title: string;
  actions?: readonly WorkflowStatusAction[];
  query(): Promise<readonly WorkflowStatus[]> | readonly WorkflowStatus[];
  save?(statuses: readonly WorkflowStatus[]): Promise<readonly WorkflowStatus[]> | readonly WorkflowStatus[];
}

export type RegisteredWorkbenchStatusSet = WorkbenchStatusSetContribution & RegisteredContributionMetadata;

export interface WorkbenchStatusRegistryState {
  statusSets: Record<string, RegisteredWorkbenchStatusSet>;
  values: Record<string, readonly WorkflowStatus[]>;
}

export interface WorkbenchStatusRegistry {
  store: WorkbenchStore<WorkbenchStatusRegistryState>;
  registerStatusSet(contribution: WorkbenchStatusSetContribution, metadata?: ContributionMetadata): Disposable;
  getStatusSet(id: string): RegisteredWorkbenchStatusSet | undefined;
  listStatusSets(): RegisteredWorkbenchStatusSet[];
  getStatuses(id: string): readonly WorkflowStatus[] | undefined;
  load(id: string): Promise<readonly WorkflowStatus[]>;
  query(id: string): Promise<readonly WorkflowStatus[]>;
  save(id: string, statuses: readonly WorkflowStatus[]): Promise<readonly WorkflowStatus[]>;
}

const validateStatusActions = (
  set: WorkbenchStatusSetContribution,
  status: WorkflowStatus,
  actionIds: ReadonlySet<string>,
) => {
  for (const actionId of status.actions ?? []) {
    if (!actionIds.has(actionId)) {
      throw new Error(`Status "${set.id}.${status.id}" references unknown action "${actionId}"`);
    }
  }
};

const validateStatuses = (set: WorkbenchStatusSetContribution, statuses: readonly WorkflowStatus[]) => {
  const ids = new Set<string>();
  const actionIds = new Set((set.actions ?? []).map((action) => action.id));
  let defaultCount = 0;

  for (const status of statuses) {
    if (!status.id.trim()) throw new Error(`Status set "${set.id}" contains an empty status id`);
    if (ids.has(status.id)) throw new Error(`Status set "${set.id}" contains duplicate id "${status.id}"`);
    ids.add(status.id);
    if (!status.label.trim()) throw new Error(`Status "${set.id}.${status.id}" must have a label`);
    if (!status.color.trim()) throw new Error(`Status "${set.id}.${status.id}" must have a color`);
    if (!Number.isFinite(status.sortOrder)) throw new Error(`Status "${set.id}.${status.id}" must have a finite order`);
    validateStatusActions(set, status, actionIds);
    if (status.isDefault) defaultCount += 1;
  }

  if (defaultCount > 1) throw new Error(`Status set "${set.id}" has more than one default status`);
  return [...statuses].sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
};

export const createStatusRegistry = (): WorkbenchStatusRegistry => {
  const store = createWorkbenchStore<WorkbenchStatusRegistryState>({
    name: "workbench.statuses",
    initialState: { statusSets: {}, values: {} },
  });

  const requireSet = (id: string) => {
    const set = store.getState().statusSets[id];
    if (!set) throw new Error(`Status set is not registered: ${id}`);
    return set;
  };

  const loadingById = new Map<string, Promise<readonly WorkflowStatus[]>>();

  const query = async (id: string) => {
    const set = requireSet(id);
    const statuses = validateStatuses(set, await set.query());
    const current = store.getState();
    if (current.statusSets[id] === set) {
      store.setState({ ...current, values: { ...current.values, [id]: statuses } }, false, "queryStatuses");
    }
    return statuses;
  };

  return {
    store,

    registerStatusSet(contribution, metadata) {
      const current = store.getState();
      if (current.statusSets[contribution.id]) throw new Error(`Status set already registered: ${contribution.id}`);
      const record = { ...normalizeContributionMetadata(metadata), ...contribution };
      store.setState(
        { ...current, statusSets: { ...current.statusSets, [contribution.id]: record } },
        false,
        "registerStatusSet",
      );
      return createDisposable(() => {
        loadingById.delete(contribution.id);
        const snapshot = store.getState();
        if (snapshot.statusSets[contribution.id] !== record) return;
        const { [contribution.id]: _removed, ...statusSets } = snapshot.statusSets;
        const { [contribution.id]: _removedValues, ...values } = snapshot.values;
        store.setState({ statusSets, values }, false, "unregisterStatusSet");
      });
    },

    getStatusSet(id) {
      return store.getState().statusSets[id];
    },

    listStatusSets() {
      return Object.values(store.getState().statusSets).sort(
        (left, right) => byContributionPriority(left, right) || left.id.localeCompare(right.id),
      );
    },

    getStatuses(id) {
      return store.getState().values[id];
    },

    load(id) {
      const cached = store.getState().values[id];
      if (cached) return Promise.resolve(cached);

      const existing = loadingById.get(id);
      if (existing) return existing;

      const loading = query(id).finally(() => {
        if (loadingById.get(id) === loading) loadingById.delete(id);
      });
      loadingById.set(id, loading);
      return loading;
    },

    query,

    async save(id, statuses) {
      const set = requireSet(id);
      if (!set.save) throw new Error(`Status set is read-only: ${id}`);
      const input = validateStatuses(set, statuses);
      const saved = validateStatuses(set, await set.save(input));
      const current = store.getState();
      store.setState({ ...current, values: { ...current.values, [id]: saved } }, false, "saveStatuses");
      return saved;
    },
  };
};
