import { Badge, HStack, Stack, Text } from "@chakra-ui/react";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { EmptyState, SurfacePanel } from "@/services/components/surface";
import { useWorkspaces } from "../hooks/use-workspaces";

const Field = (props: { label: string; value: string }) => (
  <Stack gap="2xs">
    <Text textStyle="label/S/semibold" color="fg.muted" textTransform="uppercase">
      {props.label}
    </Text>
    <Text textStyle="paragraph/M/regular" wordBreak="break-all">
      {props.value}
    </Text>
  </Stack>
);

export const WorkspaceDetail = (props: { input: WorkbenchWidgetRenderInput; projectId: string }) => {
  const { input, projectId } = props;
  const shorthand = input.placement.resource?.id;
  const tab = input.placement.resource?.metadata?.tab;
  const workspace = useWorkspaces(projectId).find((entry) => entry.shorthand === shorthand);

  if (!workspace) {
    return (
      <SurfacePanel title={shorthand ?? "Workspace"}>
        <EmptyState
          title="Workspace not found"
          description={`No synced workspace matches ${shorthand ?? "this id"}.`}
        />
      </SurfacePanel>
    );
  }

  return (
    <SurfacePanel title={workspace.name} subtitle={workspace.shorthand}>
      <Stack gap="lg" maxW="720px">
        <HStack gap="sm">
          {workspace.initializing ? (
            <Badge colorPalette="blue">Initializing</Badge>
          ) : (
            <Badge colorPalette="green">Ready</Badge>
          )}
          {typeof tab === "string" ? <Badge colorPalette="gray">Tab: {tab}</Badge> : null}
        </HStack>
        <Field label="Branch" value={workspace.branch ?? "—"} />
        <Field label="Worktree path" value={workspace.worktreePath ?? "—"} />
      </Stack>
    </SurfacePanel>
  );
};
