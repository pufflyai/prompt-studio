import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import type { ReleaseStatus } from "../benchmarks/analysis";
import { PLATFORMS } from "../benchmarks/platforms";
import { ReleasePending } from "../webview/result-notices";
import { storyPlatformTrends, storyTrends } from "../webview/story-fixtures";
import { TrendsView, type TrendsViewProps } from "./trends-view";

type InteractiveTrendsProps = Pick<TrendsViewProps, "versions" | "trends"> & {
  showTable?: boolean;
  platforms?: string[];
  pending?: ReleaseStatus;
};
const InteractiveTrends = (props: InteractiveTrendsProps) => {
  const [chosenVersions, setChosenVersions] = useState<string[]>();
  const [showTable, setShowTable] = useState(props.showTable ?? false);
  const [platforms, setPlatforms] = useState(props.platforms ?? PLATFORMS.map((platform) => platform.id));
  return (
    <Box h="100dvh">
      <TrendsView
        versions={props.versions}
        trends={props.trends}
        platforms={platforms}
        chosenVersions={chosenVersions}
        showTable={showTable}
        notice={props.pending ? <ReleasePending status={props.pending} /> : undefined}
        onPlatformsChange={setPlatforms}
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
  args: { versions: storyTrends.versions, trends: storyPlatformTrends },
};
export default meta;
type Story = CanvasFrame<typeof InteractiveTrends>;
export const AllPlatforms: Story = {
  id: "extensions-prompt-studio-dev-performance-trends--all-platforms",
};
export const OnePlatform: Story = {
  id: "extensions-prompt-studio-dev-performance-trends--one-platform",
  args: { platforms: ["linux-x64"] },
};
export const AsTable: Story = {
  id: "extensions-prompt-studio-dev-performance-trends--as-table",
  args: { showTable: true },
};
export const ReleasePendingTrends: Story = {
  id: "extensions-prompt-studio-dev-performance-trends--release-pending",
  description: "A published release whose benchmarks are still running is named instead of drawn as zero.",
  args: {
    pending: {
      version: "0.52.0",
      finished: ["linux-x64"],
      running: ["darwin-arm64", "darwin-x64", "win32-x64"],
      missing: [],
      failed: [],
    },
  },
};
export const NoReleaseResults: Story = {
  id: "extensions-prompt-studio-dev-performance-trends--no-release-results",
  args: {
    versions: [],
    trends: [],
    pending: {
      version: "0.45.0",
      finished: [],
      running: [],
      missing: PLATFORMS.map((platform) => platform.id),
      failed: [],
    },
  },
};
export const ReleaseSuitesFailed: Story = {
  id: "extensions-prompt-studio-dev-performance-trends--release-suites-failed",
  description:
    "A finished release run whose suites failed on some platforms names them instead of leaving silent gaps.",
  args: {
    pending: {
      version: "0.51.0",
      finished: PLATFORMS.map((platform) => platform.id),
      running: [],
      missing: [],
      failed: ["macOS x64 · Side navigation", "macOS x64 · Chat rendering", "Windows x64 · Workbench interactions"],
    },
  },
};
