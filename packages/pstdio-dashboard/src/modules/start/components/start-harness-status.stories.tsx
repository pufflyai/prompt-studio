import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { AgentInfo } from "pstdio-api-contracts";
import { StartHarnessStatus } from "./start-harness-status";

const remoteHelper: AgentInfo = {
  id: "example.remote.harness.helper",
  name: "Remote helper",
  availability: { type: "INSTALLED" },
  capabilities: [],
  supportsModels: false,
};

const unavailableHelper: AgentInfo = {
  ...remoteHelper,
  availability: { type: "NOT_FOUND", reason: "Connect a machine in this extension's settings." },
};

const meta: Meta<typeof StartHarnessStatus> = {
  title: "Start/HarnessStatus",
  component: StartHarnessStatus,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <Box maxW="52rem">
        <Story />
      </Box>
    ),
  ],
  args: {
    agents: [],
    onReviewExtensions: () => undefined,
    onCheckAgain: () => undefined,
  },
};

export default meta;
type Story = StoryObj<typeof StartHarnessStatus>;

export const NoHarnesses: Story = {};

export const AllUnavailable: Story = {
  args: {
    agents: [
      unavailableHelper,
      {
        ...unavailableHelper,
        id: "example.local.harness.helper",
        name: "Local helper",
        availability: { type: "NOT_FOUND" },
      },
    ],
  },
};

export const AvailableWithoutModels: Story = { args: { agents: [remoteHelper] } };

export const MixedAvailability: Story = {
  args: { agents: [unavailableHelper, { ...remoteHelper, id: "example.other.harness.helper" }] },
};

export const Checking: Story = { args: { isPending: true, isFetching: true } };

export const CheckingAgain: Story = { args: { agents: [unavailableHelper], isFetching: true } };

export const CheckFailed: Story = { args: { isError: true } };

export const RefreshFailed: Story = { args: { agents: [unavailableHelper], isError: true } };

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <Box maxW="20rem">
        <Story />
      </Box>
    ),
  ],
  args: { agents: [unavailableHelper] },
};
