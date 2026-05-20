import { Badge, Stack } from "@chakra-ui/react";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { EmptyState, SurfaceListRow, SurfacePanel } from "@/services/components/surface";
import { workspaceResource } from "@/services/workbench/resources/resource-kinds";
import { useWorkspaces } from "../hooks/use-workspaces";

export const WorkspacesOverview = (props: { input: WorkbenchWidgetRenderInput; projectId: string }) => {
  const { input, projectId } = props;
  const workspaces = useWorkspaces(projectId).filter((workspace) => !workspace.archived);

  return (
    <SurfacePanel title="Workspaces" subtitle={`${workspaces.length} active`}>
      {workspaces.length === 0 ? (
        <EmptyState title="No workspaces yet" description="Workspaces created for tickets will appear here." />
      ) : (
        <Stack gap="xs" maxW="720px">
          {workspaces.map((workspace) => (
            <SurfaceListRow
              key={workspace.id}
              icon="GitBranch"
              title={workspace.name}
              description={workspace.branch ?? workspace.worktreePath ?? workspace.shorthand}
              trailing={
                workspace.initializing ? (
                  <Badge colorPalette="blue" size="sm">
                    Initializing
                  </Badge>
                ) : undefined
              }
              onClick={() =>
                void input.workbench.resources.openResource(
                  workspaceResource(workspace.shorthand, { label: workspace.name }),
                )
              }
            />
          ))}
        </Stack>
      )}
    </SurfacePanel>
  );
};
