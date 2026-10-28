import { Dialog } from "@chakra-ui/react";
import type { ResourceAnchorPage, ResourceRef } from "@pstdio/sdk/extensions";
import type { Meta, StoryObj } from "@storybook/react";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { RelatedResources } from "./related-resources";
import type { ResourceLinksService } from "./resource-links-types";

const ticket: ResourceRef = {
  type: "ticket",
  id: "ticket",
  extensionId: "planner",
  projectId: "project",
  label: "PS-490 · General resource linking",
};
const artifact: ResourceRef = {
  type: "artifact",
  id: "prototype",
  extensionId: "artifacts",
  projectId: "project",
  label: "Interaction prototype",
  icon: "file-code",
};
const workspace: ResourceRef = {
  type: "workspace",
  id: "worktree",
  extensionId: "pstdio",
  projectId: "project",
  label: "WS-180 · Implementation",
  icon: "folder",
};
const missing: ResourceRef = { type: "note", id: "deleted-resource", extensionId: "notes", projectId: "project" };

const service = (items: ResourceAnchorPage["items"], fail = false): ResourceLinksService => ({
  list: async () => {
    if (fail) throw new Error("The connection was interrupted. Try again.");
    return { items };
  },
  add: async () => undefined,
  remove: async () => undefined,
  search: async () => [
    { resource: artifact, description: "Artifacts" },
    { resource: workspace, description: "Workspaces" },
  ],
  resolve: async () => [
    { resource: artifact, open: async () => undefined },
    { resource: workspace, open: async () => undefined },
  ],
  subscribe: () => () => undefined,
});

const meta = {
  title: "Workbench/Resource links",
  component: RelatedResources,
  args: { resource: ticket, onClose: () => undefined },
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Dialog.Root open>
          <Dialog.Positioner>
            <Dialog.Content maxW="lg">
              <Story />
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>
      </WorkbenchThemeProvider>
    ),
  ],
} satisfies Meta<typeof RelatedResources>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Related: Story = {
  args: {
    service: service([
      { source: ticket, target: { ...artifact, role: "result" } },
      { source: workspace, target: { ...ticket, role: "primary" } },
      { source: ticket, target: missing },
    ]),
  },
};
export const Empty: Story = { args: { service: service([]) } };
export const Failure: Story = { args: { service: service([], true) } };
export const Loading: Story = { args: { service: { ...service([]), list: () => new Promise(() => {}) } } };
