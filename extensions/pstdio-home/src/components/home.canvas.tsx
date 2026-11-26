import { Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { recentProjectResources } from "../recent-resources";
import { HomePromptCarousel } from "./home-prompt-carousel";
import { HomeWelcome } from "./home-welcome";
import { ProjectSetupStatus } from "./project-setup-status";
import { StartRecentList } from "./start-recent-list";

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
const missingGitError =
  "default extensions: Failed to clone https://github.com/pufflyai/prompt-studio.git at pstdio@0.40.0: spawn git ENOENT";
interface StartPagePreviewProps {
  setupError?: string;
  empty?: boolean;
  buildFails?: boolean;
}
const StartPagePreview = (props: StartPagePreviewProps) => {
  const { setupError, empty, buildFails } = props;
  return (
    <Stack w="full" maxW="2xl" px="lg" pt="4xl" pb="3xl" gap="2xl" position="relative">
      {setupError && <ProjectSetupStatus error={setupError} onRetry={() => undefined} />}
      <HomeWelcome />
      <HomePromptCarousel
        onBuild={async () => {
          if (buildFails) throw new Error("Build temporarily unavailable. Try again.");
        }}
      />
      <StartRecentList
        resources={recentProjectResources(
          (empty ? [] : resources).map(({ id, title, icon, status }) => ({
            resource: {
              id,
              type: status ? "session" : "example",
              label: title,
              icon,
              ...(status ? { metadata: { status } } : {}),
            },
            target: { kind: "page", page: { kind: "page", extensionId: "example", id: "detail" } },
          })),
        )}
        onOpen={() => undefined}
      />
    </Stack>
  );
};
const meta: CanvasMeta<typeof StartPagePreview> = {
  title: "Extensions/Home/Project home",
  component: StartPagePreview,
  args: { buildFails: false },
  controls: { buildFails: { type: "boolean", label: "Fail session startup" } },
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
  args: { empty: true },
};
