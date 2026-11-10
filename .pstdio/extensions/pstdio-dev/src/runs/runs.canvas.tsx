import { Button, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { AttachedMenu, ResizableSplitLayout, ScrollArea } from "@pstdio/ui";
import { useState } from "react";
import { DEFAULT_PLATFORM } from "../benchmarks/platforms";
import { storyRefs, storyRuns } from "../webview/story-runs";
import { RunForm, type RunRequest } from "./run-form";
import { RunList } from "./run-list";

interface RunsStoryProps {
  error?: string;
}
const RunsStory = (props: RunsStoryProps) => {
  const [request, setRequest] = useState<RunRequest>({
    commits: ["pstdio@0.45.0", "pstdio@0.43.0"],
    suites: ["storage", "runtime"],
    platforms: [DEFAULT_PLATFORM],
  });
  const [collapsed, setCollapsed] = useState(false);
  return (
    <ResizableSplitLayout
      h="100dvh"
      resizableSide="right"
      collapsed={collapsed}
      collapsible
      defaultSizePx={280}
      minSizePx={144}
      maxSizePx={320}
      contentMinSizePx={320}
      resizeLabel="Resize New run menu"
      onCollapsedChange={setCollapsed}
      contentPanel={
        <Stack p="lg" minW="0">
          {collapsed ? (
            <Button alignSelf="end" onClick={() => setCollapsed(false)}>
              New run
            </Button>
          ) : null}
          <RunList runs={storyRuns} onCancel={() => {}} onOpen={() => {}} />
        </Stack>
      }
      resizablePanel={
        <AttachedMenu>
          <ScrollArea h="full">
            <Stack p="lg">
              <RunForm
                value={request}
                refs={storyRefs}
                pending={false}
                error={props.error}
                onChange={setRequest}
                onStart={() => {}}
              />
            </Stack>
          </ScrollArea>
        </AttachedMenu>
      }
    />
  );
};
const meta: CanvasMeta<typeof RunsStory> = {
  title: "Extensions/Prompt Studio Dev/Benchmark runs",
  component: RunsStory,
  fullscreen: true,
  description:
    "Open the commit input to see every tag; pstdio@0.45.0 is Measured and not run again. Pick a platform other than Linux x64 to see Relay storage disabled.",
};
export default meta;
type Story = CanvasFrame<typeof RunsStory>;
export const Runs: Story = {
  id: "extensions-prompt-studio-dev-benchmark-runs--runs",
};
export const GitHubSignedOut: Story = {
  id: "extensions-prompt-studio-dev-benchmark-runs--git-hub-signed-out",
  args: { error: "GitHub CLI is not available or not signed in. Install gh and run `gh auth login` in this project." },
};
