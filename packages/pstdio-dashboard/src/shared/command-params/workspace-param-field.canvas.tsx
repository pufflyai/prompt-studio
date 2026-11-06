import { Button, Dialog, HStack, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import type { WorkspaceProviderDescriptor } from "@pstdio/sdk/api";
import { ChatInput, ChatWorkspaceHub, createSerializedPromptState } from "@pstdio/ui/chat-ui";
import { HarnessModelMenu } from "@pstdio/ui/param-editor";
import { createWorkbench } from "@pstdio/workbench";
import { type CommandParamEntry, type CommandParamValue, normalizeCommandParamValues } from "@pstdio/workbench/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { selectDashboardProject } from "@/shared/app/project-context";
import { ExtensionIcon } from "@/shared/components/extension-icon";
import { WorkspaceProviderFields } from "@/shared/workspaces/workspace-provider-fields";
import { workspaceProviderParamSchema } from "@/shared/workspaces/workspace-provider-param-schema";
import { workspaceProvidersQueryKey } from "@/shared/workspaces/workspace-providers";
import { WorkspaceParamField } from "./workspace-param-field";
import { defaultWorkspaceValues } from "./workspace-param-values";

const projectId = "project-1";
const workbench = createWorkbench();
selectDashboardProject(workbench, { id: projectId, name: "Prompt Studio" });
const providers: WorkspaceProviderDescriptor[] = [
  {
    id: "pstdio.worktree",
    label: "Git worktree",
    icon: "git-branch",
    description: "Create an isolated branch in the project repository.",
    params: {
      base: {
        type: "select",
        label: "Base branch",
        defaultValue: "main",
        required: true,
        options: ["main", "develop", "feature/documents"].map((value) => ({
          label: value,
          value,
          icon: "git-commit-horizontal",
        })),
      },
    },
  },
  {
    id: "cloud.environment",
    label: "Remote environment",
    icon: "rocket",
    description: "The provider supplies its files. Local files are not uploaded or synchronized.",
    params: { image: { type: "text", label: "Environment image", required: true } },
  },
];
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } } });
queryClient.setQueryData(workspaceProvidersQueryKey(projectId), providers);
interface WorkspaceParamPreviewProps {
  providerIds?: string[];
}
const WorkspaceParamPreview = (props: WorkspaceParamPreviewProps) => {
  const { providerIds } = props;
  const [value, setValue] = useState<CommandParamValue>("");
  const entry = {
    key: "workspace",
    type: "workspace",
    label: "Workspace",
    required: false,
    providers: providerIds,
  } satisfies CommandParamEntry;
  return (
    <QueryClientProvider client={queryClient}>
      <Dialog.Root open size="lg">
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Run attempt</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="sm">
                <WorkspaceParamField
                  workbench={workbench}
                  entry={entry}
                  value={value}
                  disabled={false}
                  onChange={setValue}
                  onUpdateValue={setValue}
                />
                <Text data-testid="workspace-param-value" textStyle="paragraph/XS/regular" color="fg.muted">
                  {String(value)}
                </Text>
              </Stack>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </QueryClientProvider>
  );
};
const meta = {
  title: "Product/Commands/Workspace parameters",
  component: WorkspaceParamPreview,
  fullscreen: true,
} satisfies CanvasMeta<typeof WorkspaceParamPreview>;
export default meta;
type Story = CanvasFrame<typeof meta>;
// The dialog opens without a choice; the field commits the first type and its defaults.
export const AllWorkspaceTypes: Story = {
  id: "commandparams-workspaceparamfield--all-workspace-types",
};
export const GitWorktreeOnly: Story = {
  id: "commandparams-workspaceparamfield--git-worktree-only",
  args: { providerIds: ["pstdio.worktree"] },
};
export const NoMatchingType: Story = {
  id: "commandparams-workspaceparamfield--no-matching-type",
  args: { providerIds: ["acme.missing"] },
};

const CustomHarnessIcon = () => (
  <ExtensionIcon name="data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTYgMTYiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTIgMmwxMiA2LTEyIDZ6IiBmaWxsPSJjdXJyZW50Q29sb3IiLz48L3N2Zz4=" />
);
// Synthetic state only: creation does not touch a project or provider from Canvas.
export const ComposerWorkspace = () => {
  const [workspace, setWorkspace] = useState({
    providerId: providers[0].id,
    params: defaultWorkspaceValues(providers[0]),
  });
  const provider = providers.find((provider) => provider.id === workspace.providerId)!;
  let invalid = false;
  try {
    normalizeCommandParamValues(workspaceProviderParamSchema(provider), workspace.params);
  } catch {
    invalid = true;
  }
  const [created, setCreated] = useState(false);
  return (
    <QueryClientProvider client={queryClient}>
      <Stack gap="0">
        <ChatWorkspaceHub
          additions={0}
          deletions={0}
          workspaceControl={
            <HStack gap="2xs">
              <Button size="xs" variant="ghost">
                This device
              </Button>
              <Button size="xs" variant="ghost">
                {created ? "New workspace" : "Create workspace"}
              </Button>
            </HStack>
          }
          options={
            !created && (
              <Stack gap="xs">
                <WorkspaceProviderFields
                  typeLabel="Workspace type"
                  providers={providers}
                  provider={provider}
                  values={workspace.params}
                  disabled={false}
                  optionStates={{}}
                  onRetryOptions={() => {}}
                  onProviderChange={(providerId) => {
                    const next = providers.find((provider) => provider.id === providerId)!;
                    setWorkspace({ providerId, params: defaultWorkspaceValues(next) });
                  }}
                  onValueChange={(key, value) =>
                    setWorkspace((current) => ({ ...current, params: { ...current.params, [key]: value } }))
                  }
                />
                <Button size="xs" disabled={invalid} onClick={() => setCreated(true)}>
                  Create workspace
                </Button>
              </Stack>
            )
          }
        />
        <ChatInput
          defaultState={createSerializedPromptState("Keep this draft")}
          actions={
            <HarnessModelMenu
              agentOptions={[{ value: "custom", label: "External harness", icon: CustomHarnessIcon }]}
              selectedAgent="custom"
              onSelectAgent={() => {}}
              modelOptions={[{ value: "model", label: "Saved model" }]}
              selectedModel="model"
              onSelectModel={() => {}}
              size="xs"
            />
          }
        />
      </Stack>
    </QueryClientProvider>
  );
};
