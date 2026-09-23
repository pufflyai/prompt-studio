import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useMutation } from "@tanstack/react-query";
import { dashboardCommandIds } from "@/shared/app/commands";
import { FolderPicker } from "@/shared/filesystem/folder-picker";
import { createProject } from "../data/project-creation";

export const CreateProjectWidget = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const mutation = useMutation({ mutationFn: createProject });
  const openProject = async (path: string) => {
    try {
      const project = await mutation.mutateAsync({ path });
      await input.workbench.commands.executeCommand(dashboardCommandIds.selectProject, {
        project: { id: project.id, name: project.name },
      });
      input.workbench.layout.removeWidgetPlacement(input.instance.instanceId);
    } catch {
      /* The picker shows the server error and allows retry. */
    }
  };
  return (
    <FolderPicker
      isOpening={mutation.isPending}
      error={mutation.error?.message}
      onSelect={openProject}
      onClose={() => input.workbench.layout.removeWidgetPlacement(input.instance.instanceId)}
    />
  );
};
