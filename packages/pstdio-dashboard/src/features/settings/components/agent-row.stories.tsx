import { Box, Table } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";

import { AgentRow } from "./agent-row";

const meta: Meta<typeof AgentRow> = {
  title: "Settings/AgentRow",
  component: AgentRow,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <Box maxWidth="640px">
        <Table.Root size="sm" variant="outline">
          <Table.Body>
            <Story />
          </Table.Body>
        </Table.Root>
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof AgentRow>;

export const EnabledDefault: Story = {
  args: {
    name: "Claude Code",
    isInstalled: true,
    isEnabled: true,
    isDefault: true,
    binaryPath: "/usr/local/bin/claude",
    isToggling: false,
    onToggle: () => undefined,
    onSetDefault: () => undefined,
  },
};

export const EnabledNotDefault: Story = {
  args: {
    name: "OpenCode",
    isInstalled: true,
    isEnabled: true,
    isDefault: false,
    binaryPath: "/usr/local/bin/opencode",
    isToggling: false,
    onToggle: () => undefined,
    onSetDefault: () => undefined,
  },
};

export const InstalledNotEnabled: Story = {
  args: {
    name: "OpenCode",
    isInstalled: true,
    isEnabled: false,
    isDefault: false,
    isToggling: false,
    onToggle: () => undefined,
    onSetDefault: () => undefined,
  },
};

export const NotInstalled: Story = {
  args: {
    name: "Codex",
    isInstalled: false,
    isEnabled: false,
    isDefault: false,
    isToggling: false,
    onToggle: () => undefined,
    onSetDefault: () => undefined,
  },
};

export const Toggling: Story = {
  args: {
    name: "OpenCode",
    isInstalled: true,
    isEnabled: false,
    isDefault: false,
    isToggling: true,
    onToggle: () => undefined,
    onSetDefault: () => undefined,
  },
};
