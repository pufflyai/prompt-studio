import type { Meta, StoryObj } from "@storybook/react";
import { LazyMarkdownEditor } from "./lazy-markdown-editor";

const meta: Meta<typeof LazyMarkdownEditor> = {
  title: "Patterns/Editors/Lazy Markdown Editor",
  component: LazyMarkdownEditor,
  args: { defaultState: "# Ticket description\n\nThe editor loads when this view opens.", isEditable: true },
};

export default meta;
type Story = StoryObj<typeof LazyMarkdownEditor>;

export const Default: Story = {};
