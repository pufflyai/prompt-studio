import { Box, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { Slider } from "@pstdio/ui";
import { useState } from "react";
import { FormulaPlot } from "../../components/examples/formula-plot";
import { calculateFormula } from "../../services/financial-formulas";
import { landingStorySlotRecipe } from "./landing-story";

const FormulaDemo = () => {
  const story = useSlotRecipe({ recipe: landingStorySlotRecipe })({});
  const [years, setYears] = useState(10);
  const calculation = calculateFormula("savings", { principal: 10000, monthly: 300, rate: 6, years, inflation: 2 });
  const result = calculation.value;
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
          <FormulaPlot result={calculation} years={years} />
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
  fullscreen: true,
} satisfies CanvasMeta<typeof FormulaDemo>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const Interactive: Story = {
  id: "theme-landing-formula-demo--interactive",
};
export const NarrowPanel: Story = {
  id: "theme-landing-formula-demo--narrow-panel",
  decorators: [
    (Story) => (
      <Box width="80">
        <Story />
      </Box>
    ),
  ],
};
