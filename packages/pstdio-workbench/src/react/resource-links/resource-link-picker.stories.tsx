import type { Meta, StoryObj } from "@storybook/react";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { ResourceLinkPicker } from "./resource-link-picker";

const meta = {
  title: "Workbench/Resource link picker",
  component: ResourceLinkPicker,
  args: {
    excludeKey: "",
    busy: false,
    onCancel: () => undefined,
    onSelect: async () => undefined,
    service: {
      list: async () => ({ items: [] }),
      add: async () => undefined,
      remove: async () => undefined,
      search: async () => [
        {
          resource: { type: "artifact", id: "prototype", extensionId: "artifacts", label: "Interaction prototype" },
          description: "Artifacts",
        },
        { resource: { type: "note", id: "notes", extensionId: "notes", label: "Project notes" }, description: "Notes" },
      ],
      resolve: async () => [],
      subscribe: () => () => undefined,
    },
  },
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Story />
      </WorkbenchThemeProvider>
    ),
  ],
} satisfies Meta<typeof ResourceLinkPicker>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Search: Story = {};
export const Empty: Story = { args: { service: { ...meta.args.service, search: async () => [] } } };
export const Failure: Story = {
  args: {
    service: {
      ...meta.args.service,
      search: async () => {
        throw new Error("The owner search is unavailable.");
      },
    },
  },
};
