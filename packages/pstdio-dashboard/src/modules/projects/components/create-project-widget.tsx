import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useMutation, useMutationState } from "@tanstack/react-query";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { FolderPicker } from "@/shared/filesystem/folder-picker";
import { createProject } from "../data/project-creation";

interface CreateProjectWidgetProps {
  input: WorkbenchPanelRenderInput;
  onProjectOpening?: (project: Promise<{ id: string }>) => Promise<void>;
}
export const CreateProjectWidget = (props: CreateProjectWidgetProps) => {
  const { input, onProjectOpening } = props;
  const mutationKey = ["create-project", input.instance.instanceId];
  const mutation = useMutation({ mutationKey, mutationFn: createProject });
  // Setup temporarily replaces this view; the mutation cache retains its owner across remounts.
  const attempts = useMutationState({
    filters: { mutationKey, exact: true },
    select: (attempt) => ({ pending: attempt.state.status === "pending", error: attempt.state.error?.message }),
  });
  const openProject = async (path: string) => {
    const initialProjectId = getDashboardSelectedProjectId(input.workbench);
    const creating = mutation.mutateAsync({ path });
    // Track the expected project before creation; setup waits for enabled contributions.
    const setup = onProjectOpening?.(creating);
    try {
      const project = await creating;
      if (getDashboardSelectedProjectId(input.workbench) !== initialProjectId) return;
      await input.workbench.commands.executeCommand(dashboardCommandIds.selectProject, {
        project: { id: project.id, name: project.name },
      });
      input.workbench.layout.removeWidgetPlacement(input.instance.instanceId);
      await setup;
    } catch {
      /* The picker shows the server error and allows retry. */
    }
  };
  return (
    <FolderPicker
      isOpening={attempts.some((attempt) => attempt.pending)}
      error={attempts.at(-1)?.error}
      onSelect={openProject}
      onClose={() => input.workbench.layout.removeWidgetPlacement(input.instance.instanceId)}
    />
  );
};
