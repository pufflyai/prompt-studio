import { Flex, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { DEFAULT_PLATFORM, DEFAULT_SUITES } from "../benchmarks/platforms";
import { storyRuns } from "../webview/story-fixtures";
import { RunForm, type RunRequest } from "./run-form";
import { RunList } from "./run-list";

interface RunsStoryProps {
  error?: string;
}

const RunsStory = (props: RunsStoryProps) => {
  const [request, setRequest] = useState<RunRequest>({
    commits: ["pstdio@0.45.0", "main"],
    suites: DEFAULT_SUITES,
    platforms: [DEFAULT_PLATFORM],
    samples: 10,
  });
  return (
    <Flex gap="lg" wrap="wrap" align="flex-start" p="lg">
      <Stack flex="1 1 24rem" maxW="lg">
        <RunForm
          value={request}
          quick={[
            { label: "Latest release", ref: "pstdio@0.45.0" },
            { label: "Previous release", ref: "pstdio@0.44.0" },
            { label: "main", ref: "main" },
          ]}
          pending={false}
          error={props.error}
          onChange={setRequest}
          onStart={() => {}}
        />
      </Stack>
      <Stack flex="999 1 32rem" minW="0">
        <RunList runs={storyRuns} onCancel={() => {}} onOpen={() => {}} />
      </Stack>
    </Flex>
  );
};

const meta: Meta<typeof RunsStory> = {
  title: "Extensions/Prompt Studio Dev/Benchmark runs",
  component: RunsStory,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof RunsStory>;

export const Runs: Story = {};
export const GitHubSignedOut: Story = {
  args: { error: "GitHub CLI is not available or not signed in. Install gh and run `gh auth login` in this project." },
};
