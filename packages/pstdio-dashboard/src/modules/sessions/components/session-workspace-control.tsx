import type { Dispatch, SetStateAction } from "react";
import { useEffect } from "react";
import { useProject } from "@/shared/projects/use-project";
import { createDashboardWorkspaceOptions, type DashboardWorkspaceOption } from "@/shared/workspaces/workspace-options";
import type { DashboardSessionView } from "../data/dashboard-sessions";
import { resolveRuntimeWorkspaceSelection } from "../runtime/session-runtime-selection";
import { SessionWorkspaceMenu } from "./session-workspace-menu";

interface SessionWorkspaceControlProps {
  view: DashboardSessionView;
  projectId: string | undefined;
  selectedWorkspaceId: string;
  setSelectedWorkspaceId: Dispatch<SetStateAction<string>>;
  onSelectWorkspace?: (workspace: DashboardWorkspaceOption) => void;
}

const getSelectedWorkspaceLabel = (input: {
  selectedWorkspaceId: string;
  workspaceTitle: string;
  workspaceShorthand: string;
  workspaces: ReturnType<typeof createDashboardWorkspaceOptions>;
}) => {
  const selected = input.workspaces.find((workspace) => workspace.id === input.selectedWorkspaceId);
  if (selected) return selected.title;
  return input.workspaceTitle || input.workspaceShorthand;
};

/** Workspace identity/selector for the workspace hub header. */
export const SessionWorkspaceControl = (props: SessionWorkspaceControlProps) => {
  const { view, projectId, selectedWorkspaceId, setSelectedWorkspaceId, onSelectWorkspace } = props;
  const { isLoading: isProjectLoading } = useProject(projectId);
  const workspaceOptions = createDashboardWorkspaceOptions(projectId);
  const workspaceSelectionKey = workspaceOptions.map((workspace) => workspace.id).join("|");
  const defaultWorkspaceId = workspaceOptions.find((workspace) => workspace.isDefault)?.id ?? null;
  const selectedWorkspaceLabel = getSelectedWorkspaceLabel({
    selectedWorkspaceId,
    workspaceTitle: view.workspaceTitle,
    workspaceShorthand: view.workspaceShorthand,
    workspaces: workspaceOptions,
  });
  const isExistingSession = Boolean(view.sessionId);

  // The options factory returns a fresh array on every render; the key captures the IDs the
  // resolver reads without turning that array identity into an unconditional effect trigger.
  // biome-ignore lint/correctness/useExhaustiveDependencies: workspaceSelectionKey represents workspaceOptions.
  useEffect(() => {
    const nextWorkspaceId = resolveRuntimeWorkspaceSelection({
      workspaces: workspaceOptions,
      selectedWorkspaceId,
      // A draft with no bound workspace falls back to the project's default (root repo).
      fallbackWorkspaceId: view.workspaceId ?? defaultWorkspaceId,
    });
    if (nextWorkspaceId !== selectedWorkspaceId) setSelectedWorkspaceId(nextWorkspaceId);
  }, [defaultWorkspaceId, selectedWorkspaceId, setSelectedWorkspaceId, view.workspaceId, workspaceSelectionKey]);

  const handleSelectWorkspace = (workspaceId: string) => {
    const workspace = workspaceOptions.find((option) => option.id === workspaceId);
    setSelectedWorkspaceId(workspaceId);
    if (workspace) onSelectWorkspace?.(workspace);
  };

  return (
    <SessionWorkspaceMenu
      workspaces={workspaceOptions}
      selectedWorkspaceId={selectedWorkspaceId}
      selectedWorkspaceLabel={selectedWorkspaceLabel}
      onSelectWorkspace={handleSelectWorkspace}
      isDisabled={isExistingSession || isProjectLoading}
    />
  );
};
