import { Button, Dialog, Text } from "@chakra-ui/react";
import type { WorkspaceProviderDescriptor } from "@pstdio/sdk/api";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { createDashboardWorkspace } from "@/shared/workspaces/workspace-actions";
import { WorkspaceProviderForm } from "./workspace-provider-form";

export const CreateWorkspaceWidget = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const projectId = getDashboardSelectedProjectId(input.workbench);
  const query = useQuery({
    queryKey: ["workspace-providers", projectId],
    queryFn: () => apiRequest<WorkspaceProviderDescriptor[]>(`/v1/projects/${projectId}/workspace-providers`),
    enabled: Boolean(projectId),
  });
  const mutation = useMutation({ mutationFn: createDashboardWorkspace });
  const close = () => input.workbench.layout.removeWidgetPlacement(input.instance.instanceId);
  return (
    <>
      <Dialog.Header>
        <Dialog.Title>Open workspace</Dialog.Title>
      </Dialog.Header>
      <Dialog.Body>
        {query.isPending ? (
          <Text>Loading workspace providers...</Text>
        ) : query.error ? (
          <Text role="alert" color="fg.error">
            {query.error.message}
          </Text>
        ) : (
          <WorkspaceProviderForm
            providers={query.data ?? []}
            busy={mutation.isPending}
            onSubmit={async (providerId, params) => {
              if (!projectId) return;
              await mutation.mutateAsync({ projectId, providerId, params });
              close();
            }}
          />
        )}
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="outline" disabled={mutation.isPending} onClick={close}>
          Cancel
        </Button>
      </Dialog.Footer>
    </>
  );
};
