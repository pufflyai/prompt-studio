import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { buildAnalysis } from "../analysis";
import { channelNames } from "../sites";
import { storyAnalysis } from "../webview/story-fixtures";
import { AnalysisSections } from "./analysis-sections";

const meta: CanvasMeta<typeof AnalysisSections> = {
  title: "Extensions/Social radar/Analysis",
  component: AnalysisSections,
  args: { analysis: storyAnalysis, channelNames: channelNames([]), onOpenMention: () => {} },
  decorators: [
    (Story) => (
      <Box p="lg" maxW="7xl">
        <Story />
      </Box>
    ),
  ],
};
export default meta;
type Story = CanvasFrame<typeof AnalysisSections>;
export const FourteenDays: Story = {
  id: "extensions-social-radar-analysis--fourteen-days",
};
export const NoThreadsYet: Story = {
  id: "extensions-social-radar-analysis--no-threads-yet",
  args: { analysis: buildAnalysis({ threads: [], days: 14 }) },
};
