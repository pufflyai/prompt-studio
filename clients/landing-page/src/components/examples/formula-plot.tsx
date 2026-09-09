import { chakra, HStack, Stack, Text } from "@chakra-ui/react";
import { type ExampleFormula, type FormulaInputs, formatMoney } from "../../content/formula-glossary-content";
import { useToolDemoStyles } from "../../hooks/use-landing-styles";

export const FormulaPlot = (props: { formula: ExampleFormula; inputs: FormulaInputs }) => {
  const { formula, inputs } = props;
  const styles = useToolDemoStyles();
  const result = formula.evaluate(inputs);
  const maximum = Math.max(inputs.principal, result) * 1.1;
  const plotY = (value: number) => 200 - (value / maximum) * 176;
  const points = Array.from(
    { length: 101 },
    (_, index) => `${24 + index * 3.52},${plotY(formula.evaluate({ ...inputs, years: (inputs.years * index) / 100 }))}`,
  ).join(" ");

  return (
    <Stack gap="xs">
      <HStack justify="space-between" textStyle="label/XS/regular" color="fg.muted">
        <Text>Value over time</Text>
        <Text>{formatMoney(maximum)}</Text>
      </HStack>
      <chakra.svg
        css={styles.plot}
        viewBox="0 0 400 224"
        role="img"
        aria-label={`${formula.name} over ${inputs.years} years`}
      >
        <chakra.path css={styles.plotGrid} d="M24 24H376 M24 112H376 M24 200H376 M24 24V200 M200 24V200 M376 24V200" />
        <chakra.path css={styles.plotCursor} d={`M24 ${plotY(inputs.principal)}H376`} />
        <chakra.polyline css={styles.plotCurve} points={points} />
        <chakra.circle css={styles.plotPoint} cx="376" cy={plotY(result)} r="5" />
      </chakra.svg>
      <HStack justify="space-between" textStyle="label/XS/regular" color="fg.muted">
        <Text>Today</Text>
        <Text>Year {inputs.years}</Text>
      </HStack>
    </Stack>
  );
};
