import { Button, Dialog, Stack } from "@chakra-ui/react";
import { createWorkbenchCore } from "@pstdio/workbench";
import type { CommandParamEntry, CommandParamValue } from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { ProjectTemplateAsset } from "@/modules/settings/data/template-provider-api";
import { selectDashboardProject } from "@/shared/app/project-context";
import { ResourceParamField } from "./resource-param-field";
import { projectTemplateAssetsQueryKey, TemplateParamField } from "./template-param-field";

const projectId = "project-1";
const workbench = createWorkbenchCore();
selectDashboardProject(workbench, { id: projectId, name: "Prompt Studio" });
workbench.resources.registerProvider({
  id: "story.workspaces",
  kind: "workspace",
  list: () => [
    {
      resource: {
        kind: "workspace",
        uri: "pstdio://workspace/ps-324-a1",
        id: "workspace-1",
        label: "PS-324_A1",
        icon: "GitBranch",
      },
      description: "bugfix/template-resource-dropdowns",
    },
    {
      resource: {
        kind: "workspace",
        uri: "pstdio://workspace/ps-323-a1",
        id: "workspace-2",
        label: "PS-323_A1",
        icon: "GitBranch",
      },
      description: "feature/extension-input",
    },
  ],
});

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } } });
queryClient.setQueryData<ProjectTemplateAsset[]>(projectTemplateAssetsQueryKey(projectId), [
  {
    id: "ticket:bug-fix",
    projectId,
    name: "bug-fix",
    title: "Bug fix",
    templateType: "pstdio.pstdio-planner.template-type.ticket",
    localType: "ticket",
    groupLabel: "Ticket",
    groupOrder: 10,
    commands: { list: "list", read: "read", save: "save", delete: "delete" },
  },
  {
    id: "ticket:proposal",
    projectId,
    name: "proposal",
    title: "Proposal",
    templateType: "pstdio.pstdio-planner.template-type.ticket",
    localType: "ticket",
    groupLabel: "Ticket",
    groupOrder: 10,
    commands: { list: "list", read: "read", save: "save", delete: "delete" },
  },
]);

const templateEntry = {
  key: "template",
  type: "template",
  label: "Ticket template",
  required: false,
  templateType: "pstdio.pstdio-planner.template-type.ticket",
} satisfies CommandParamEntry;

const workspaceEntry = {
  key: "workspace",
  type: "resource",
  label: "Workspace",
  required: false,
  resourceType: "workspace",
} satisfies CommandParamEntry;

const DashboardParamFieldsPreview = () => {
  const [template, setTemplate] = useState<CommandParamValue>("");
  const [workspace, setWorkspace] = useState<CommandParamValue>("");

  return (
    <QueryClientProvider client={queryClient}>
      <Dialog.Root open size="lg">
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Refine ticket</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body p="0">
              <Stack gap="0">
                <TemplateParamField
                  workbench={workbench}
                  entry={templateEntry}
                  value={template}
                  disabled={false}
                  onChange={setTemplate}
                />
                <ResourceParamField
                  workbench={workbench}
                  entry={workspaceEntry}
                  value={workspace}
                  disabled={false}
                  onChange={setWorkspace}
                />
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button size="sm" variant="ghost">
                Cancel
              </Button>
              <Button size="sm" variant="primary">
                Run
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </QueryClientProvider>
  );
};

const meta = {
  title: "CommandParams/DashboardParamFields",
  component: DashboardParamFieldsPreview,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DashboardParamFieldsPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TemplateAndResourceDropdowns: Story = {};
