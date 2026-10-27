import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { DocumentHeader } from "./document-header";

const meta = { title: "Primitives/DocumentHeader", component: DocumentHeader } satisfies Meta<typeof DocumentHeader>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Connected: Story = {
  args: { title: "Project plan", participants: [{ id: "alex", label: "Alex", deviceName: "Laptop", color: "blue" }] },
};
export const Alone: Story = { args: { title: "Project plan", participants: [] } };
export const Narrow: Story = {
  ...Connected,
  args: { ...Connected.args, title: "documentation/requirements/platform/native-markdown-editor.md" },
  render: (args) => (
    <Box maxW="2xs">
      <DocumentHeader {...args} />
    </Box>
  ),
};
