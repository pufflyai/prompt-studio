import { Button, Dialog, Text } from "@chakra-ui/react";
import type { CreateWorkspaceCommandParams } from "@pstdio/sdk/extensions";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createDashboardWorkspace } from "@/shared/workspaces/workspace-actions";
import { workspaceProvidersQueryOptions } from "@/shared/workspaces/workspace-providers";
import { WorkspaceProviderForm } from "./workspace-provider-form";

export const CreateWorkspaceWidget = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const options = input.instance.resource?.metadata as CreateWorkspaceCommandParams | undefined;
  const projectId = input.instance.resource?.id;
  const query = useQuery(workspaceProvidersQueryOptions(projectId));
  const mutation = useMutation({ mutationFn: createDashboardWorkspace });
  const close = () => input.workbench.layout.removeWidgetPlacement(input.instance.instanceId);
  return (
    <>
      <Dialog.Header>
        <Dialog.Title>Create workspace</Dialog.Title>
      </Dialog.Header>
      {query.isPending || query.error ? (
        <>
          <Dialog.Body>
            {query.error ? (
              <Text role="alert" color="fg.error">
                {query.error.message}
              </Text>
            ) : (
              <Text>Loading workspace providers...</Text>
            )}
          </Dialog.Body>
          <Dialog.Footer>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" disabled>
              Create workspace
            </Button>
          </Dialog.Footer>
        </>
      ) : (
        <WorkspaceProviderForm
          providers={query.data ?? []}
          busy={mutation.isPending}
          onCancel={close}
          onSubmit={async (providerId, params) => {
            if (!projectId) return;
            await mutation.mutateAsync({
              projectId,
              providerId,
              params,
              anchors: options?.anchors,
              shorthand_base: options?.shorthand_base,
            });
            close();
          }}
        />
      )}
    </>
  );
};
