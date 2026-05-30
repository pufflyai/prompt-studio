import type { Meta, StoryObj } from "@storybook/react";
import { AttachmentList } from "./attachment-list";

const meta: Meta<typeof AttachmentList> = {
  title: "Patterns/Chat/Attachment List",
  component: AttachmentList,
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj<typeof AttachmentList>;

const sampleAttachments = ["workspace/analysis/report.md", "workspace/data/users.csv"];

export const Default: Story = {
  args: {
    attachments: sampleAttachments,
    onSelect: (resourceId) => console.log("Selected:", resourceId),
    onRemove: (resourceId) => console.log("Remove:", resourceId),
  },
};
