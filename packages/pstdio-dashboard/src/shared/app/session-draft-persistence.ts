import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { resolveDashboardStorage } from "./dashboard-storage";
import type { DashboardProjectSelectionPersistence } from "./project-selection-persistence";

export interface DashboardSessionDraftPersistence {
  getDraft(draftKey: string): string;
  setDraft(draftKey: string, text: string): void;
}

interface CreateDashboardSessionDraftPersistenceInput {
  namespace: string;
  storage?: WorkbenchStorageLike;
  projectSelection: Pick<DashboardProjectSelectionPersistence, "getSelectedProjectId">;
}

export const dashboardSessionDraftStorageKey = (namespace: string, projectId: string) =>
  `${namespace}:session-drafts:${projectId}`;

const readDrafts = (storage: WorkbenchStorageLike, key: string): Record<string, string> => {
  const raw = storage.getItem(key);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
};

// Unsent chat input, keyed by the session (or new-session draft) it was typed into and
// stored per project. One entry per project keeps a project's drafts easy to drop together.
export const createDashboardSessionDraftPersistence = (
  input: CreateDashboardSessionDraftPersistenceInput,
): DashboardSessionDraftPersistence => {
  const storage = resolveDashboardStorage(input.storage);

  const resolveKey = () => {
    const projectId = input.projectSelection.getSelectedProjectId();
    return projectId ? dashboardSessionDraftStorageKey(input.namespace, projectId) : undefined;
  };

  return {
    getDraft: (draftKey) => {
      const key = resolveKey();
      if (!key) return "";

      const draft = readDrafts(storage, key)[draftKey];
      return typeof draft === "string" ? draft : "";
    },
    setDraft: (draftKey, text) => {
      const key = resolveKey();
      if (!key) return;

      const drafts = readDrafts(storage, key);
      if (drafts[draftKey] === text || (!text && !(draftKey in drafts))) return;

      if (text) drafts[draftKey] = text;
      else delete drafts[draftKey];

      storage.setItem(key, JSON.stringify(drafts));
    },
  };
};
