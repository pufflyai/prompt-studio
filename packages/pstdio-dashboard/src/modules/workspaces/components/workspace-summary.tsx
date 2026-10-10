import { Button, Center, Wrap } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import { useWorkbenchResourceActionResolver, type WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { workspaceMetadataString } from "@/shared/workspaces/workspace-file-resource";

export const WorkspaceSummary = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const resource = input.instance.resource;
  const resolveActions = useWorkbenchResourceActionResolver(input.workbench);
  const actions = resource ? resolveActions(resource) : [];
  const state = workspaceMetadataString(resource, "workspaceProviderState") ?? "provisioning";
  const label = state.replaceAll("_", " ");
  const error = workspaceMetadataString(resource, "workspaceError");

  return (
    <Center h="full" minH="0" bg="bg" p="md">
      <EmptyState
        title={resource?.label ?? "Workspace"}
        description={error ?? `Workspace state: ${label.charAt(0).toUpperCase()}${label.slice(1)}`}
      >
        <Wrap justify="center" gap="sm">
          {actions.map((action) => (
            <Button key={action.key} size="sm" variant="outline" disabled={action.isDisabled} onClick={action.onClick}>
              {action.label}
            </Button>
          ))}
        </Wrap>
      </EmptyState>
    </Center>
  );
};
