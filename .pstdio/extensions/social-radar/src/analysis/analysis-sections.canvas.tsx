import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { buildAnalysis } from "../analysis";
import { channelNames } from "../sites";
import { storyAnalysis } from "../webview/story-fixtures";
import { AnalysisSections } from "./analysis-sections";

const meta: Meta<typeof AnalysisSections> = {
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
type Story = StoryObj<typeof AnalysisSections>;
export const FourteenDays: Story = {};
export const NoThreadsYet: Story = { args: { analysis: buildAnalysis({ threads: [], days: 14 }) } };
