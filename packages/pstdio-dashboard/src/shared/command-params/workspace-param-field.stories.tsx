import { Dialog, Stack, Text } from "@chakra-ui/react";
import type { WorkspaceProviderDescriptor } from "@pstdio/sdk/api";
import { createWorkbench } from "@pstdio/workbench";
import type { CommandParamEntry, CommandParamValue } from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { expect, waitFor, within } from "storybook/test";
import { selectDashboardProject } from "@/shared/app/project-context";
import { workspaceProvidersQueryKey } from "@/shared/workspaces/workspace-providers";
import { WorkspaceParamField } from "./workspace-param-field";

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
  title: "CommandParams/WorkspaceParamField",
  component: WorkspaceParamPreview,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WorkspaceParamPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
// The dialog opens without a choice; the field commits the first type and its defaults.
export const AllWorkspaceTypes: Story = {
  play: async () => {
    const value = await within(document.body).findByTestId("workspace-param-value");
    await waitFor(() =>
      expect(value.textContent).toBe(JSON.stringify({ providerId: "pstdio.worktree", params: { base: "main" } })),
    );
  },
};
export const GitWorktreeOnly: Story = { args: { providerIds: ["pstdio.worktree"] } };
export const NoMatchingType: Story = { args: { providerIds: ["acme.missing"] } };
