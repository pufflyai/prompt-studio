import type { UpdateProjectInput } from "@pstdio/sdk/api";
import { classifyApiWrite, operationSubject, type WorkbenchOperations } from "@pstdio/workbench";
import { WORKBENCH_SETTINGS_OPEN_COMMAND_ID } from "@pstdio/workbench/react";

export type ProjectDefaultPatch = Pick<UpdateProjectInput, "default_agent_id" | "default_agent_model">;
type ProjectDefaults = Required<ProjectDefaultPatch>;

const domain = "project.defaults";

export const createProjectDefaultOperations = <T extends ProjectDefaults>(input: {
  operations: WorkbenchOperations;
  write(projectId: string, patch: ProjectDefaultPatch, signal: AbortSignal): Promise<T>;
}) => ({
  snapshot: input.operations.getSnapshot,
  subscribe: input.operations.subscribe,
  project<P extends ProjectDefaults>(projectId: string | undefined, confirmed?: P) {
    if (!projectId || !confirmed) return confirmed;
    let projected = confirmed;
    for (const entry of input.operations.getSnapshot().pending) {
      if (entry.domain === domain && entry.projectId === projectId) {
        projected = { ...projected, ...(entry.intent as ProjectDefaultPatch) };
      }
    }
    return projected;
  },
  submit(projectId: string, patch: ProjectDefaultPatch, reconcile: (saved: T, signal: AbortSignal) => Promise<void>) {
    return input.operations.submit({
      projectId,
      subjects: [operationSubject("project", projectId, "defaults")],
      domain,
      title: "Change project defaults",
      sourceCommand: { id: WORKBENCH_SETTINGS_OPEN_COMMAND_ID, args: { panelId: "runtime" } },
      intent: patch,
      draft: patch,
      write: (signal) => input.write(projectId, patch, signal),
      reconcile,
      classify: classifyApiWrite,
    });
  },
});
