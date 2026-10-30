import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useLandingStyles } from "../../hooks/use-landing-styles";
import { DownloadPanel } from "../downloads/download-panel";
import { AssemblyFrame } from "./assembly-frame";

const meta = {
  title: "Landing/Initial Editor Frame",
  component: AssemblyFrame,
  fullscreen: true,
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
} satisfies CanvasMeta<typeof AssemblyFrame>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const BeforeJavaScript: Story = {
  id: "landing-initial-editor-frame--before-java-script",
};
export const Narrow: Story = {
  id: "landing-initial-editor-frame--narrow",
  description: "Narrow editors use 95% of the fitted space, aligning with the mobile copy.",
  decorators: [
    (Story) => (
      <Box width="80">
        <Story />
      </Box>
    ),
  ],
};
