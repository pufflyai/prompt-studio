import { classifyApiWrite, getWorkbenchOperations, operationSubject } from "@pstdio/workbench";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeState } from "@/lib/sync/runtime-state";
import { dashboardCommandIds } from "@/shared/app/commands";

interface ProjectReceipt {
  id: string;
  name: string;
  created?: boolean;
}

interface TeamProjectInput {
  teamAccountId: string;
  name: string;
}

interface FolderDraft {
  path: string;
  team?: TeamProjectInput;
  project?: ProjectReceipt;
  setupFailed?: boolean;
}

const domain = "project.open-folder";

export const getProjectCreation = createRuntimeState((owner) => {
  const api = getRuntimeApiClient(owner);
  const queries = getDashboardScopedQueries(owner);
  const operations = getWorkbenchOperations(queries);
  let authorityGeneration = 0;
  queries.subscribeScopeRetirement((scope) => {
    if (!Object.keys(scope).length) authorityGeneration++;
  });

  const open = async (path: string, team?: TeamProjectInput): Promise<ProjectReceipt> => {
    const subject = operationSubject("project", "open-folder", path);
    const snapshot = operations.getSnapshot();
    if (snapshot.pending.some((entry) => entry.subjects.includes(subject) && activeStatuses.has(entry.status))) {
      throw new Error("This folder is already opening.");
    }

    const previous = snapshot.recovery
      .filter((entry) => {
        const draft = entry.draft as FolderDraft | undefined;
        return entry.domain === domain && draft?.path === path;
      })
      .at(-1);
    const retained = previous?.draft as FolderDraft | undefined;
    if (retained && retained.team?.teamAccountId !== team?.teamAccountId)
      throw new Error("This folder has a pending change for another account. Check System activity.");
    const draft: FolderDraft = retained ? { ...retained } : { path, ...(team && { team }) };
    if (previous) {
      const generation = authorityGeneration;
      const moved = await operations.transfer(previous.id, () => true);
      if (!moved || generation !== authorityGeneration) throw new Error("The original authority is no longer active.");
    }

    return operations.submit({
      domain,
      subjects: [subject],
      sourceCommand: {
        id: dashboardCommandIds.createProject,
        ...(draft.team && { args: { teamAccountId: draft.team.teamAccountId } }),
      },
      title: "Open project folder",
      intent: path,
      draft,
      releaseOnDiscard: true,
      classify: classifyApiWrite,
      async write(signal) {
        if (draft.project) {
          if (draft.setupFailed) await api.projects.retrySetup(draft.project.id, { signal });
          return draft.project;
        }

        // The server serializes by canonical folder path and opens the same project for a repeated explicit selection.
        const { id, name, created } = await api.projects.create(
          { ...draft.team, initial_workspace: { provider_id: "pstdio.root", params: { path } } },
          { signal },
        );
        signal.throwIfAborted();
        draft.project = { id, name, created };
        return draft.project;
      },
      async reconcile(project, signal) {
        const workspaces = await api.workspaces.list(project.id, { signal });
        signal.throwIfAborted();
        const home = workspaces.find((workspace) => workspace.is_default);
        draft.setupFailed = Boolean(
          home?.setup_error || home?.provider_state === "failed" || home?.provider_state === "provider_missing",
        );
        if (home?.setup_error) throw new Error(home.setup_error);
        if (!home?.root_path || home.initializing || home.provider_state !== "ready")
          throw new Error("The project folder is not ready. Open it again to retry setup.");
      },
    }).result;
  };

  return { open, read: operations.getSnapshot, subscribe: operations.subscribe };
});

const activeStatuses: ReadonlySet<string> = new Set(["queued", "writing", "reconciling"]);

export const projectCreationPresentation = (
  snapshot: ReturnType<ReturnType<typeof getProjectCreation>["read"]>,
  teamAccountId?: string,
) => {
  const isOpening = snapshot.pending.some((entry) => entry.domain === domain && activeStatuses.has(entry.status));
  const failure = snapshot.recovery
    .filter((entry) => {
      const draft = entry.draft as FolderDraft | undefined;
      return entry.domain === domain && !entry.dismissed && draft?.team?.teamAccountId === teamAccountId;
    })
    .at(-1);
  const draft = failure?.draft as FolderDraft | undefined;
  const error = failure?.error;
  return {
    isOpening,
    path: draft?.path,
    name: draft?.team?.name,
    error: isOpening || !error ? undefined : String(error instanceof Error ? error.message : error),
  };
};
