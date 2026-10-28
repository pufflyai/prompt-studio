import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { storyTrends } from "../webview/story-fixtures";
import { type TrendsMode, TrendsView, type TrendsViewProps } from "./trends-view";

type InteractiveTrendsProps = Pick<TrendsViewProps, "mode" | "versions" | "metrics"> & { showTable?: boolean };

const InteractiveTrends = (props: InteractiveTrendsProps) => {
  const [mode, setMode] = useState<TrendsMode>(props.mode);
  const [versionIndex, setVersionIndex] = useState(props.versions.length - 1);
  const [chosenVersions, setChosenVersions] = useState<string[]>();
  const [showTable, setShowTable] = useState(props.showTable ?? false);
  const [platform, setPlatform] = useState("linux-x64");
  return (
    <Box h="100dvh">
      <TrendsView
        versions={props.versions}
        metrics={props.metrics}
        platform={platform}
        mode={mode}
        versionIndex={versionIndex}
        chosenVersions={chosenVersions}
        showTable={showTable}
        onPlatformChange={setPlatform}
        onModeChange={setMode}
        onVersionChange={setVersionIndex}
        onChosenVersionsChange={setChosenVersions}
        onShowTableChange={setShowTable}
      />
    </Box>
  );
};

const meta: Meta<typeof InteractiveTrends> = {
  title: "Extensions/Prompt Studio Dev/Performance trends",
  component: InteractiveTrends,
  parameters: { layout: "fullscreen" },
  args: { versions: storyTrends.versions, metrics: storyTrends.metrics },
};
export default meta;
type Story = StoryObj<typeof InteractiveTrends>;

export const AcrossVersions: Story = { args: { mode: "versions" } };
export const AsTable: Story = { args: { mode: "versions", showTable: true } };
export const OneVersion: Story = { args: { mode: "version" } };
export const NoReleaseResults: Story = { args: { mode: "versions", versions: [], metrics: [] } };
