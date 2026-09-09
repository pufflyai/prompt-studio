import { Box, chakra, HStack, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Slider } from "@/components/primitives/slider";

const FormulaDemo = (props: { interactive: boolean }) => {
  const { interactive } = props;
  const styles = useSlotRecipe({ key: "landingToolDemo" })({});
  const story = useSlotRecipe({ key: "landingStory" })({});
  const [input, setInput] = useState(0.25);
  const result = Math.round(Math.sin(input * Math.PI * 2) * 100) / 100;
  const points = Array.from(
    { length: 101 },
    (_, i) => `${24 + i * 3.52},${112 - Math.sin((i / 100) * Math.PI * 2) * 88}`,
  ).join(" ");

  return (
    <Box css={story.page}>
      <Box css={story.panel}>
        <Box css={story.panelHeader}>Sine wave</Box>
        <Stack css={story.panelBody}>
          <Text textStyle="heading/M">y = sin(2πx)</Text>
          <chakra.svg css={styles.plot} viewBox="0 0 400 224" role="img" aria-label="Sine wave curve">
            <chakra.path
              css={styles.plotGrid}
              d="M24 24H376 M24 112H376 M24 200H376 M24 24V200 M200 24V200 M376 24V200"
            />
            <chakra.polyline css={styles.plotCurve} points={points} />
            {interactive && (
              <>
                <chakra.path css={styles.plotCursor} d={`M${24 + input * 352} 24V200`} />
                <chakra.circle
                  css={styles.plotPoint}
                  cx={24 + input * 352}
                  cy={112 - Math.sin(input * Math.PI * 2) * 88}
                  r="5"
                />
              </>
            )}
          </chakra.svg>
          {interactive && (
            <Stack gap="md">
              <HStack css={styles.toolbar} textStyle="mono/XS">
                <Text>Input x = {input.toFixed(2)}</Text>
                <Text as="output">y = {result.toFixed(2)}</Text>
              </HStack>
              <Slider
                aria-label={["Formula input x"]}
                min={0}
                max={1}
                step={0.01}
                value={[input]}
                onValueChange={({ value }) => setInput(value[0])}
              />
            </Stack>
          )}
        </Stack>
      </Box>
    </Box>
  );
};

const meta = {
  title: "Theme/Landing Formula Demo",
  component: FormulaDemo,
  args: { interactive: true },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof FormulaDemo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {};
export const Static: Story = { args: { interactive: false } };
export const NarrowPanel: Story = {
  decorators: [
    (Story) => (
      <Box width="80">
        <Story />
      </Box>
    ),
  ],
};
