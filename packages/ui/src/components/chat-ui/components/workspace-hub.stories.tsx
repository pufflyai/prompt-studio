import { Button } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { ArrowUpRight } from "lucide-react";
import { ChatWorkspaceHub } from "./workspace-hub";

const meta: Meta<typeof ChatWorkspaceHub> = {
  title: "Patterns/Chat/Workspace Hub",
  component: ChatWorkspaceHub,
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj<typeof ChatWorkspaceHub>;

export const Default: Story = {
  args: {
    changesLabel: "9 files changed",
    additions: 83,
    deletions: 9,
    action: (
      <Button size="sm" variant="plain">
        Review changes
        <ArrowUpRight size={14} />
      </Button>
    ),
  },
};
