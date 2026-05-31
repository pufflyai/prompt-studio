import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { useWorkbenchStore, type WorkbenchWidgetRenderInput } from "../../../react";
import { SESSION_KIND, surfaceWorkspaces, TERMINAL_KIND, workspaceResource } from "../mock-data";

interface CandidateListProps {
  input: WorkbenchWidgetRenderInput;
  title: string;
  kind: string;
}

// The candidates come from listResources, which scopes every provider to the active
// primary — so this list only ever shows the current workspace's children, and changes
// the moment you switch workspaces.
const CandidateList = (props: CandidateListProps) => {
  const { input, title, kind } = props;
  const { workbench } = input;
  const entries = workbench.resources.listResources("").filter((entry) => entry.resource.kind === kind);

  return (
    <Stack gap="1">
      <Text textStyle="label/S/regular" color="fg">
        {title}
      </Text>
      {entries.map((entry) => (
        <Button
          key={entry.resource.uri}
          size="xs"
          variant="ghost"
          justifyContent="flex-start"
          onClick={() => void workbench.resources.openResource(entry.resource)}
        >
          Open {entry.resource.label}
        </Button>
      ))}
    </Stack>
  );
};

// The primary (main) widget: switch the active workspace and open its scoped sessions /
// terminals. Everything else in the example reacts to what happens here.
export const WorkspaceDetail = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const { workbench } = input;
  useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  const primary = workbench.getPrimaryResource();

  return (
    <Stack gap="5" p="5" h="full" minH="0" overflowY="auto">
      <Stack gap="1">
        <Text textStyle="label/XS/regular" color="fg.muted">
          primary anchor
        </Text>
        <Text textStyle="title/S/regular" color="fg">
          {primary?.label ?? "No workspace"}
        </Text>
      </Stack>

      <Stack gap="2">
        <Text textStyle="label/S/regular" color="fg">
          Switch the primary (workspace)
        </Text>
        <HStack>
          {surfaceWorkspaces.map((workspace) => (
            <Button
              key={workspace.id}
              size="sm"
              variant={primary?.uri === workspace.uri ? "solid" : "outline"}
              onClick={() => void workbench.resources.openResource(workspaceResource(workspace))}
            >
              {workspace.label}
            </Button>
          ))}
        </HStack>
        <Text textStyle="paragraph/XS/regular" color="fg.muted">
          Switching re-scopes the terminal (secondary) and disconnects a session (floating) that does not belong to the
          new workspace.
        </Text>
      </Stack>

      <CandidateList input={input} title="Scoped sessions → attached (floating)" kind={SESSION_KIND} />
      <CandidateList input={input} title="Scoped terminals → secondary" kind={TERMINAL_KIND} />
    </Stack>
  );
};
