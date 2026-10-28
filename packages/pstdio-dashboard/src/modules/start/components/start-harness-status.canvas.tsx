import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
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
const meta: CanvasMeta<typeof StartHarnessStatus> = {
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
type Story = CanvasVariant<typeof StartHarnessStatus>;
export const NoHarnesses: Story = {
  id: "start-harnessstatus--no-harnesses",
};
export const AllUnavailable: Story = {
  id: "start-harnessstatus--all-unavailable",
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
export const AvailableWithoutModels: Story = {
  id: "start-harnessstatus--available-without-models",
  args: { agents: [remoteHelper] },
};
export const MixedAvailability: Story = {
  id: "start-harnessstatus--mixed-availability",
  args: { agents: [unavailableHelper, { ...remoteHelper, id: "example.other.harness.helper" }] },
};
export const Checking: Story = {
  id: "start-harnessstatus--checking",
  args: { isPending: true, isFetching: true },
};
export const CheckFailed: Story = {
  id: "start-harnessstatus--check-failed",
  args: { isError: true },
};
export const RefreshFailed: Story = {
  id: "start-harnessstatus--refresh-failed",
  args: { agents: [unavailableHelper], isError: true },
};
export const Narrow: Story = {
  id: "start-harnessstatus--narrow",
  decorators: [
    (Story) => (
      <Box maxW="20rem">
        <Story />
      </Box>
    ),
  ],
  args: { agents: [unavailableHelper] },
};
