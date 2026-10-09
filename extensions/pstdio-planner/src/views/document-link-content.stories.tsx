import type { Meta, StoryObj } from "@storybook/react";
import { DocumentLinkContent } from "./document-link-content";

const meta = {
  title: "Planner/Document Link",
  component: DocumentLinkContent,
  args: {
    label: "Copy Link",
    href: "https://studio.example/projects/project/extensions/pstdio.pstdio-planner/ticket?resource=ticket&document=saved-file",
  },
} satisfies Meta<typeof DocumentLinkContent>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Loading: Story = { args: { href: "", loading: true } };
export const Unavailable: Story = { args: { href: "", error: "Document unavailable: deleted-file" } };
