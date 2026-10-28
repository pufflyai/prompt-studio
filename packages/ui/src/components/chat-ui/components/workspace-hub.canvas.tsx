import { Button, IconButton, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { ArrowUpRight, ChevronDown, GitBranch } from "lucide-react";
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

const workspaceControl = (
  <Button size="xs" variant="ghost" px="2xs">
    <GitBranch size={14} />
    <Text textStyle="label/XS/medium" color="fg" ml="2xs">
      main
    </Text>
    <ChevronDown size={14} />
  </Button>
);

const openWorkspaceAction = (
  <IconButton size="xs" variant="ghost" aria-label="Open workspace">
    <ArrowUpRight size={14} />
  </IconButton>
);

export const Default: Story = {
  args: {
    workspaceControl,
    additions: 83,
    deletions: 9,
    action: openWorkspaceAction,
  },
};

export const WithChanges: Story = {
  args: {
    workspaceControl,
    additions: 148,
    deletions: 37,
    action: openWorkspaceAction,
  },
};

export const NoChanges: Story = {
  args: {
    workspaceControl,
    additions: 0,
    deletions: 0,
    action: openWorkspaceAction,
  },
};

export const SettingUp: Story = {
  args: {
    workspaceControl,
    additions: 0,
    deletions: 0,
    status: "loading",
    statusLabel: "Setting up workspace — installing dependencies",
    action: openWorkspaceAction,
  },
};

export const SetupFailed: Story = {
  args: {
    workspaceControl,
    additions: 0,
    deletions: 0,
    status: "error",
    statusLabel: "Setup failed — bun install could not resolve dependencies",
    action: openWorkspaceAction,
  },
};
