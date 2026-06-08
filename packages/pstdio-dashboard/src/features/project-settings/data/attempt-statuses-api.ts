import { executePlannerCommand, type PlannerWorkspaceStatusDefinition } from "@/features/ticket-list/data/api/planner";

export interface AttemptStatusResponse {
  id: string;
  project_id: string;
  name: string;
  color: string;
  sort_order: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const toResponse = (projectId: string, status: PlannerWorkspaceStatusDefinition, index = 0): AttemptStatusResponse => ({
  id: status.id,
  project_id: projectId,
  name: status.label,
  color: status.color ?? "gray",
  sort_order: status.sortOrder,
  is_default: index === 0,
  created_at: "",
  updated_at: "",
  deleted_at: null,
});

export const createAttemptStatus = async (projectId: string, input: { name: string; color: string }) => {
  const created = await executePlannerCommand<PlannerWorkspaceStatusDefinition>(projectId, "workspaceStatus.create", {
    label: input.name,
    color: input.color,
  });
  return toResponse(projectId, created);
};

export const updateAttemptStatus = async (
  projectId: string,
  id: string,
  input: { name?: string; color?: string; sort_order?: number; is_default?: boolean },
) => {
  const updated = await executePlannerCommand<PlannerWorkspaceStatusDefinition>(projectId, "workspaceStatus.update", {
    statusId: id,
    label: input.name,
    color: input.color,
  });
  return toResponse(projectId, updated);
};

export const deleteAttemptStatus = async (projectId: string, id: string) =>
  executePlannerCommand(projectId, "workspaceStatus.delete", { statusId: id });
