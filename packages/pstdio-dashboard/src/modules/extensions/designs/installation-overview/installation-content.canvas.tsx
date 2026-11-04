import { Box, Button, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import claudeLogo from "harness-claude-code/assets/icon.svg?raw";
import codexLogo from "harness-codex/assets/icon.svg?raw";
import opencodeLogo from "harness-open-code/assets/icon.svg?raw";
import piLogo from "harness-pi/assets/icon.svg?raw";
import { useState } from "react";
import { InstallationContent, InstallationIndicator } from "./installation-content";
import { english } from "./messages";
import type { InstallationPreviewJob } from "./types";

const queuedAt = new Date().toISOString();
const job: InstallationPreviewJob = {
  id: "planner",
  installName: "pstdio-planner",
  displayName: "Project Planner",
  icon: "Kanban",
  status: "queued",
  queuedAt,
};
const t = (key: keyof typeof english) => english[key];
const meta = {
  title: "Extensions/Installation Overview",
  description: "Deferred design only. Fixture data and local interactions never install extensions or persist state.",
  component: InstallationContent,
  args: { jobs: [], t, onRetry: () => {}, onDismiss: () => {} },
  decorators: [
    (Story) => (
      <Box w="performance-popover">
        <Story />
      </Box>
    ),
  ],
} satisfies CanvasMeta<typeof InstallationContent>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const Idle: Story = { id: "extensions-installing-extensions--idle" };
export const Running: Story = {
  id: "extensions-installing-extensions--running",
  args: {
    jobs: [
      { ...job, status: "running", startedAt: queuedAt },
      { ...job, id: "notes", installName: "pstdio-notes", displayName: "Notes", icon: "NotebookPen" },
    ],
  },
};
export const Failed: Story = {
  id: "extensions-installing-extensions--failed",
  args: { jobs: [{ ...job, status: "failed", error: "The source could not be downloaded." }] },
};
export const Complete: Story = {
  id: "extensions-installing-extensions--complete",
  args: { jobs: [{ ...job, status: "completed", completedAt: queuedAt }] },
};
export const DifferentProjects: Story = {
  id: "extensions-installing-extensions--different-projects",
  args: {
    jobs: [
      { ...job, id: "failed-a", projectId: "a", status: "failed", error: "The source could not be downloaded." },
      { ...job, id: "completed-b", projectId: "b", status: "completed", completedAt: queuedAt },
    ],
  },
};
export const StatusComplete: Story = {
  id: "extensions-installing-extensions--status-complete",
  render: (args) => <InstallationIndicator {...args} />,
  args: Complete.args,
};
export const InstallingWithoutSelf: Story = {
  id: "extensions-installing-extensions--installing-without-self",
  args: {
    jobs: [
      { ...job, status: "running", startedAt: queuedAt },
      {
        ...job,
        id: "self",
        extensionId: "pstdio.pstdio-extension-installations",
        installName: "my-installations",
        displayName: "Installation Overview",
        status: "running",
      },
    ],
  },
};
export const ColdDetails: Story = { args: { loading: true } };

const StatusLifecycle = () => {
  const [jobs, setJobs] = useState<InstallationPreviewJob[]>([]);
  return (
    <Stack>
      <Button onClick={() => setJobs([{ ...job, status: "running", startedAt: queuedAt }])}>Start installation</Button>
      <Button onClick={() => setJobs([{ ...job, status: "completed" }])}>Finish installation</Button>
      <InstallationIndicator jobs={jobs} t={t} />
      {jobs.length > 0 && <InstallationContent jobs={jobs} t={t} onRetry={() => {}} onDismiss={() => setJobs([])} />}
    </Stack>
  );
};
export const ActivityLifecycle: Story = {
  id: "extensions-installing-extensions--activity-lifecycle",
  render: () => <StatusLifecycle />,
};
export const QueuedBehindCompleted: Story = {
  id: "extensions-installing-extensions--queued-behind-completed",
  args: {
    jobs: [
      job,
      { ...job, id: "newer", status: "completed", queuedAt: new Date(Date.parse(queuedAt) + 1).toISOString() },
    ],
  },
};

// Retained completed batches keep a frozen overview duration; rows stay name/checkmark only.
export const CompletedOverviewDuration = () => (
  <InstallationIndicator
    jobs={[{ ...job, status: "completed", completedAt: new Date(Date.parse(queuedAt) + 65000).toISOString() }]}
    t={t}
  />
);

export const OfficialHarnessIcons: Story = {
  args: {
    jobs: [
      ["codex", "Codex", codexLogo],
      ["claude-code", "Claude Code", claudeLogo],
      ["open-code", "OpenCode", opencodeLogo],
      ["pi", "Pi", piLogo],
    ].map(([id, displayName, svg]) => ({
      ...job,
      id: id!,
      installName: `harness-${id}`,
      displayName: displayName!,
      icon: `data:image/svg+xml;base64,${btoa(svg!)}`,
      status: "running" as const,
      startedAt: queuedAt,
    })),
  },
};

// Preserve the former workbench fixture identity without registering a runtime status item.
export const WorkbenchActivityLifecycle: Story = {
  id: "pstdio-workbench-reference-core-api-status-bar-content--activity-lifecycle",
  render: () => <StatusLifecycle />,
};
export const ColdDetailShell: Story = {
  id: "pstdio-workbench-reference-core-api-status-bar--cold-detail-shell",
  args: { loading: true },
};
const DeferredDetails = () => {
  const [ready, setReady] = useState(false);
  return (
    <Stack>
      <Button onClick={() => setReady(true)}>Resolve details</Button>
      <InstallationContent jobs={Running.args!.jobs!} t={t} loading={!ready} onRetry={() => {}} onDismiss={() => {}} />
    </Stack>
  );
};
export const HeldDetailLoading: Story = {
  id: "pstdio-workbench-reference-core-api-status-bar--held-detail-loading",
  render: () => <DeferredDetails />,
};
