import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useSyncExternalStore } from "react";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { FolderPicker } from "@/shared/filesystem/folder-picker";
import { getProjectCreation, projectCreationPresentation } from "../data/project-creation";

interface CreateProjectWidgetProps {
  input: WorkbenchPanelRenderInput;
  onProjectOpening?: (project: Promise<{ id: string; created?: boolean }>) => Promise<void>;
}
export const CreateProjectWidget = (props: CreateProjectWidgetProps) => {
  const { input, onProjectOpening } = props;
  const creation = getProjectCreation();
  const snapshot = useSyncExternalStore(creation.subscribe, creation.read, creation.read);
  const presentation = projectCreationPresentation(snapshot);
  const openProject = async (path: string) => {
    const initialProjectId = getDashboardSelectedProjectId(input.workbench);
    const creating = creation.open(path);
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
      isOpening={presentation.isOpening}
      error={presentation.error}
      initialPath={presentation.path}
      onSelect={openProject}
      onClose={() => input.workbench.layout.removeWidgetPlacement(input.instance.instanceId)}
    />
  );
};
