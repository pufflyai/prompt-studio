import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { storyTrends } from "../webview/story-fixtures";
import { type TrendsMode, TrendsView, type TrendsViewProps } from "./trends-view";

type InteractiveTrendsProps = Pick<TrendsViewProps, "mode" | "versions" | "metrics"> & {
  showTable?: boolean;
};
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
const meta: CanvasMeta<typeof InteractiveTrends> = {
  title: "Extensions/Prompt Studio Dev/Performance trends",
  component: InteractiveTrends,
  fullscreen: true,
  args: { versions: storyTrends.versions, metrics: storyTrends.metrics },
};
export default meta;
type Story = CanvasFrame<typeof InteractiveTrends>;
export const AcrossVersions: Story = {
  id: "extensions-prompt-studio-dev-performance-trends--across-versions",
  args: { mode: "versions" },
};
export const AsTable: Story = {
  id: "extensions-prompt-studio-dev-performance-trends--as-table",
  args: { mode: "versions", showTable: true },
};
export const OneVersion: Story = {
  id: "extensions-prompt-studio-dev-performance-trends--one-version",
  args: { mode: "version" },
};
export const NoReleaseResults: Story = {
  id: "extensions-prompt-studio-dev-performance-trends--no-release-results",
  args: { mode: "versions", versions: [], metrics: [] },
};
