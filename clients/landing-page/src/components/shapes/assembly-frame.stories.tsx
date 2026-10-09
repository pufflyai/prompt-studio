import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useLandingStyles } from "../../hooks/use-landing-styles";
import { DownloadPanel } from "../downloads/download-panel";
import { AssemblyFrame } from "./assembly-frame";

const meta = {
  title: "Landing/Initial Editor Frame",
  component: AssemblyFrame,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => {
      const styles = useLandingStyles();
      return (
        <Box width="full" maxWidth="6xl" height="48rem">
          <Box css={styles.hero}>
            <Box css={styles.heroLayout} data-assembly-area="">
              <DownloadPanel headingLevel="h1" />
              <Box css={styles.cardSpace}>
                <Story />
              </Box>
            </Box>
          </Box>
        </Box>
      );
    },
  ],
} satisfies Meta<typeof AssemblyFrame>;

export default meta;
type Story = StoryObj<typeof meta>;
export const BeforeJavaScript: Story = {};
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <Box width="80">
        <Story />
      </Box>
    ),
  ],
};
