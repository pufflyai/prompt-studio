import { Box, HStack, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Slider } from "@/components/primitives/slider";

const VisualTool = () => {
  const styles = useSlotRecipe({ key: "landingToolDemo" })({});
  const story = useSlotRecipe({ key: "landingStory" })({});
  const [glyph, setGlyph] = useState("A");
  const [weight, setWeight] = useState(500);
  return (
    <Box css={story.page}>
      <Box css={story.panels}>
        <Box css={story.panel}>
          <Box css={story.panelHeader}>Glyph editor</Box>
          <Stack css={story.panelBody}>
            <Box css={styles.glyphs}>
              {["A", "B", "G", "R"].map((letter) => (
                <Box
                  as="button"
                  key={letter}
                  css={styles.glyph}
                  aria-pressed={letter === glyph}
                  onClick={() => setGlyph(letter)}
                >
                  {letter}
                </Box>
              ))}
            </Box>
            <Box css={styles.canvas}>
              <Box asChild css={styles.art}>
                <svg viewBox="0 0 320 280" data-weight={weight} role="img" aria-label={`Selected glyph ${glyph}`}>
                  <text x="160" y="232" data-type="glyph" textAnchor="middle" fill="currentColor">
                    {glyph}
                  </text>
                  <Box asChild css={styles.guide}>
                    <path
                      d="M24 57H296 M24 232H296 M64 32V256 M256 32V256"
                      stroke="currentColor"
                      fill="none"
                      strokeDasharray="4 4"
                    />
                  </Box>
                </svg>
              </Box>
            </Box>
            <HStack css={styles.toolbar}>
              <Text>Weight</Text>
              <Text>{weight}</Text>
            </HStack>
            <Slider
              aria-label={["Font weight"]}
              min={400}
              max={700}
              step={100}
              value={[weight]}
              onValueChange={({ value }) => setWeight(value[0])}
            />
          </Stack>
        </Box>
        <Stack gap="sm">
          <Box css={styles.metrics}>
            {["Running", "To review", "Completed"].map((label, i) => (
              <Box css={styles.metric} key={label}>
                <Text textStyle="heading/M">{[2, 1, 16][i]}</Text>
                <Text textStyle="label/S/regular">{label}</Text>
              </Box>
            ))}
          </Box>
          {["in_progress", "awaiting_input", "completed"].map((status, index) => (
            <Box as="button" css={styles.session} key={status} aria-pressed={index === 0}>
              <Text textStyle="label/M/medium">
                {["Build the font", "Polish the specimen", "Check glyph coverage"][index]}
              </Text>
              <Box css={styles.progress} aria-hidden="true">
                {Array.from({ length: 16 }, (_, i) => (
                  <Box key={i} css={styles.segment} data-filled={i < 12} data-status={status} />
                ))}
              </Box>
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  );
};

const meta = {
  title: "Theme/Landing Tool Demo",
  component: VisualTool,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof VisualTool>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Desktop: Story = {};
export const NarrowPanel: Story = {
  decorators: [
    (Story) => (
      <Box width="80">
        <Story />
      </Box>
    ),
  ],
};
