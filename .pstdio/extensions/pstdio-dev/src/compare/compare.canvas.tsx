import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
import { storyCommits, storyComparison } from "../webview/story-fixtures";
import { CompareView, type ResultFilter } from "./compare-view";

interface InteractiveCompareProps {
  base: string;
  head: string;
}
const InteractiveCompare = (props: InteractiveCompareProps) => {
  const [base, setBase] = useState(props.base);
  const [head, setHead] = useState(props.head);
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [selected, setSelected] = useState<string>();
  const [platform, setPlatform] = useState("linux-x64");
  const measured = storyCommits.filter((commit) => commit.measured).map((commit) => commit.sha);
  const both = measured.includes(base) && measured.includes(head);
  return (
    <Box h="100dvh">
      <CompareView
        commits={storyCommits}
        base={base}
        head={head}
        platform={platform}
        rows={both ? storyComparison.rows : []}
        filter={filter}
        selected={selected}
        onBaseChange={setBase}
        onHeadChange={setHead}
        onPlatformChange={setPlatform}
        onFilterChange={setFilter}
        onSelect={setSelected}
      />
    </Box>
  );
};
const meta: CanvasMeta<typeof InteractiveCompare> = {
  title: "Extensions/Prompt Studio Dev/Compare commits",
  component: InteractiveCompare,
  parameters: { layout: "fullscreen" },
  args: { base: "3d7f5766b0", head: "65d36f4490" },
};
export default meta;
type Story = CanvasVariant<typeof InteractiveCompare>;
export const BothMeasured: Story = {
  id: "extensions-prompt-studio-dev-compare-commits--both-measured",
};
export const HeadNotMeasured: Story = {
  id: "extensions-prompt-studio-dev-compare-commits--head-not-measured",
  args: { head: "f5c5c4b6e0" },
};
