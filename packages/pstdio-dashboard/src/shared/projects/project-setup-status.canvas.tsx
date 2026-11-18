import { Box, Button, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { ProjectSetupStatus } from "./project-setup-status";

const meta = {
  title: "Product/Projects/Project setup status",
  component: ProjectSetupStatus,
  args: {
    error:
      "default extensions: Failed to clone https://github.com/pufflyai/prompt-studio.git at pstdio@0.40.0: spawn git ENOENT",
    onRetry: () => {},
  },
} satisfies CanvasMeta<typeof ProjectSetupStatus>;
export default meta;
type Story = CanvasFrame<typeof meta>;
/** First run without Git or a network: the default extensions, including every agent harness, did not install. */
export const MissingGit: Story = {
  id: "projects-project-setup-status--missing-git",
};
export const Retrying: Story = {
  id: "projects-project-setup-status--retrying",
  args: { retrying: true },
};
export const FolderNotWritable: Story = {
  id: "projects-project-setup-status--folder-not-writable",
  args: { error: "EACCES: permission denied, mkdir '/Users/alex/tools/.pstdio'" },
};
export const ProviderPending: Story = {
  id: "projects-project-setup-status--provider-pending",
  args: { error: "The workspace provider has not finished setup. Retry to check its progress." },
};

const SetupRetryPreview = () => {
  const [error, setError] = useState("The folder could not be prepared.");
  const [retrying, setRetrying] = useState(false);
  return (
    <Stack h="320px" p="md">
      <Button
        disabled={!retrying}
        onClick={() => {
          setRetrying(false);
          setError("The extension download failed.");
        }}
      >
        Finish setup attempt
      </Button>
      <Box position="relative" flex="1">
        <ProjectSetupStatus error={error} retrying={retrying} onRetry={() => setRetrying(true)} />
      </Box>
    </Stack>
  );
};
export const RetryFailure: Story = {
  id: "projects-project-setup-status--retry-failure",
  render: () => <SetupRetryPreview />,
};
