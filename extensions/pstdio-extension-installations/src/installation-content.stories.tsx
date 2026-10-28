import { Box, Button, Stack } from "@chakra-ui/react";
import type { ExtensionInstallation } from "@pstdio/sdk/api";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { InstallationContent, InstallationIndicator } from "./installation-content";
import { english } from "./messages";

const queuedAt = new Date().toISOString();
const job: ExtensionInstallation = {
  id: "planner",
  installName: "pstdio-planner",
  displayName: "Project Planner",
  status: "queued",
  queuedAt,
};
const t = (key: keyof typeof english) => english[key];
const meta = {
  title: "Extensions/Installing Extensions",
  component: InstallationContent,
  args: { jobs: [], t, onRetry: () => {}, onOpen: () => {} },
  decorators: [
    (Story) => (
      <Box w="performance-popover" p="sm">
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof InstallationContent>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Idle: Story = {};
export const Running: Story = {
  args: {
    jobs: [
      { ...job, status: "running", startedAt: queuedAt },
      { ...job, id: "notes", installName: "pstdio-notes", displayName: "Notes" },
    ],
  },
};
export const Failed: Story = {
  args: { jobs: [{ ...job, status: "failed", error: "The source could not be downloaded." }] },
};
export const Complete: Story = { args: { jobs: [{ ...job, status: "completed", completedAt: queuedAt }] } };
export const DifferentProjects: Story = {
  args: {
    jobs: [
      { ...job, id: "failed-a", projectId: "a", status: "failed", error: "The source could not be downloaded." },
      { ...job, id: "completed-b", projectId: "b", status: "completed", completedAt: queuedAt },
    ],
  },
};
export const StatusComplete: Story = { render: (args) => <InstallationIndicator {...args} />, args: Complete.args };

export const InstallingWithoutSelf: Story = {
  args: {
    jobs: [
      { ...job, status: "running", startedAt: queuedAt },
      {
        ...job,
        id: "self",
        extensionId: "pstdio.pstdio-extension-installations",
        installName: "my-installations",
        displayName: "Installing Extensions",
        status: "running",
      },
    ],
  },
};
const StatusLifecycle = () => {
  const [jobs, setJobs] = useState<ExtensionInstallation[]>([]);
  return (
    <Stack>
      <Button onClick={() => setJobs([{ ...job, status: "running", startedAt: queuedAt }])}>Start installation</Button>
      <Button onClick={() => setJobs([{ ...job, status: "completed" }])}>Finish installation</Button>
      <InstallationIndicator jobs={jobs} t={t} />
    </Stack>
  );
};
export const ActivityLifecycle: Story = { render: () => <StatusLifecycle /> };
export const QueuedBehindCompleted: Story = {
  args: {
    jobs: [
      job,
      { ...job, id: "newer", status: "completed", queuedAt: new Date(Date.parse(queuedAt) + 1).toISOString() },
    ],
  },
};
