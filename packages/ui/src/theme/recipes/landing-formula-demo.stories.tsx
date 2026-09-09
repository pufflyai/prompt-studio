import { Box, chakra, HStack, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Slider } from "@/components/primitives/slider";

const FormulaDemo = () => {
  const styles = useSlotRecipe({ key: "landingToolDemo" })({});
  const story = useSlotRecipe({ key: "landingStory" })({});
  const [years, setYears] = useState(10);
  const balance = (year: number) => 10000 * 1.005 ** (year * 12) + (300 * (1.005 ** (year * 12) - 1)) / 0.005;
  const result = balance(years);
  const maximum = result * 1.1;
  const points = Array.from(
    { length: 101 },
    (_, index) => `${24 + index * 3.52},${200 - (balance((years * index) / 100) / maximum) * 176}`,
  ).join(" ");

  return (
    <Box css={story.page}>
      <Box css={story.panel}>
        <Box css={story.panelHeader}>Savings with contributions</Box>
        <Stack css={story.panelBody}>
          <Text textStyle="mono/XS">FV = P(1+i)ⁿ + C[(1+i)ⁿ−1]/i</Text>
          <Text color="fg.muted" textStyle="label/S/regular">
            Future value
          </Text>
          <Text as="output" textStyle="heading/L">
            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
              result,
            )}
          </Text>
          <chakra.svg
            css={styles.plot}
            viewBox="0 0 400 224"
            role="img"
            aria-label="Savings with contributions over time"
          >
            <chakra.path
              css={styles.plotGrid}
              d="M24 24H376 M24 112H376 M24 200H376 M24 24V200 M200 24V200 M376 24V200"
            />
            <chakra.polyline
              css={styles.plotComparison}
              points={`24,${200 - (10000 / maximum) * 176} 376,${200 - ((10000 + 300 * years * 12) / maximum) * 176}`}
            />
            <chakra.polyline css={styles.plotCurve} points={points} />
            <chakra.circle css={styles.plotPoint} cx="376" cy={200 - (result / maximum) * 176} r="5" />
          </chakra.svg>
          <HStack justify="space-between" textStyle="label/S/regular">
            <Text>Today</Text>
            <Text>Year {years}</Text>
          </HStack>
          <Slider
            aria-label={["Years"]}
            min={1}
            max={30}
            step={1}
            value={[years]}
            onValueChange={({ value }) => setYears(value[0])}
          />
        </Stack>
      </Box>
    </Box>
  );
};

const meta = {
  title: "Theme/Landing Formula Demo",
  component: FormulaDemo,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof FormulaDemo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {};
export const NarrowPanel: Story = {
  decorators: [
    (Story) => (
      <Box width="80">
        <Story />
      </Box>
    ),
  ],
};
