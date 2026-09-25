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
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="outline" disabled={mutation.isPending} onClick={close}>
          Cancel
        </Button>
      </Dialog.Footer>
    </>
  );
};
