import { Box, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { ListRow, SessionIndicator } from "@pstdio/ui";
import { HomeIcon } from "./home-icon";
import { ProjectSetupStatus } from "./project-setup-status";
import { StartAboutPanel } from "./start-about-panel";
import { type StartAction, StartActionList } from "./start-action-list";

interface PreviewResource {
  id: string;
  title: string;
  icon: string;
  status?: "completed" | "in_progress" | "awaiting_input";
}
const resources: PreviewResource[] = [
  { id: "session-1", title: "Make the weekly report easier to scan", icon: "message-circle", status: "in_progress" },
  { id: "ticket-1", title: "PS-231 Persistent project tabs", icon: "component" },
  { id: "artifact-1", title: "Weekly activity summary", icon: "file-code" },
  { id: "workspace-1", title: "PS-231_A1", icon: "computer" },
];
const StartRecentList = ({ resources }: { resources: PreviewResource[]; onOpen?: () => void }) => (
  <Stack gap="sm">
    <Text textStyle="label/L/regular">Recent</Text>
    <Stack gap="none">
      {resources.map((resource) => (
        <ListRow
          key={resource.id}
          id={resource.id}
          label={resource.title}
          role="button"
          icon={
            resource.status ? (
              <SessionIndicator status={resource.status} />
            ) : (
              <HomeIcon name={resource.icon} size={14} />
            )
          }
        />
      ))}
      {resources.length === 0 && (
        <Text textStyle="label/S/regular" color="fg.muted">
          Nothing opened yet
        </Text>
      )}
    </Stack>
  </Stack>
);

const actions: StartAction[] = [
  { id: "new-conversation", label: "New conversation", icon: "message-square", run: () => undefined },
  { id: "open-tool", label: "Open a tool", icon: "panels-top-left", run: () => undefined },
  { id: "browse-extensions", label: "Browse extensions", icon: "blocks", run: () => undefined },
];
const missingGitError =
  "default extensions: Failed to clone https://github.com/pufflyai/prompt-studio.git at pstdio@0.40.0: spawn git ENOENT";
interface StartPagePreviewProps {
  setupError?: string;
}
const StartPagePreview = (props: StartPagePreviewProps) => {
  const { setupError } = props;
  return (
    <Stack w="full" maxW="52rem" pt="4xl" pb="3xl" gap="3xl">
      <Stack gap="xs" minW="0">
        <Text textStyle="heading/M">Prompt Studio</Text>
        <Text textStyle="paragraph/M/regular" color="fg.muted">
          Project home
        </Text>
      </Stack>
      {setupError && <ProjectSetupStatus error={setupError} onRetry={() => undefined} />}
      <StartAboutPanel />
      <Stack direction={{ base: "column", md: "row" }} gap={{ base: "3xl", md: "4xl" }} align="flex-start" minW="0">
        <Box flex="1" minW="0" w="full">
          <StartActionList actions={actions} />
        </Box>
        <Box flex="1" minW="0" w="full">
          <StartRecentList resources={resources} onOpen={() => undefined} />
        </Box>
      </Stack>
    </Stack>
  );
};
const meta: CanvasMeta<typeof StartPagePreview> = {
  title: "Home/Project home",
  component: StartPagePreview,
};
export default meta;
type Story = CanvasFrame<typeof StartPagePreview>;
export const Default: Story = {
  id: "start-startpage--default",
};
/** First run without Git or network: the default extensions, including every agent harness, did not install. */
export const SetupDidNotFinish: Story = {
  id: "start-startpage--setup-did-not-finish",
  args: { setupError: missingGitError },
};
export const NoRecentResources: Story = {
  id: "start-startpage--no-recent-resources",
  render: () => (
    <Stack w="full" maxW="52rem" gap="3xl">
      <StartAboutPanel />
      <Stack direction={{ base: "column", md: "row" }} gap={{ base: "3xl", md: "4xl" }} align="flex-start" minW="0">
        <Box flex="1" minW="0" w="full">
          <StartActionList actions={actions} />
        </Box>
        <Box flex="1" minW="0" w="full">
          <StartRecentList resources={[]} onOpen={() => undefined} />
        </Box>
      </Stack>
    </Stack>
  ),
};
