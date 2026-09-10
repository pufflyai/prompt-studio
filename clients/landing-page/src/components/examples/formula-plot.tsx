import { chakra, HStack, Stack, Text } from "@chakra-ui/react";
import { useToolDemoStyles } from "../../hooks/use-landing-styles";
import { type FormulaResult, formatMoney } from "../../services/financial-formulas";

export const FormulaPlot = (props: { result: FormulaResult; years: number }) => {
  const { result, years } = props;
  const styles = useToolDemoStyles();
  const all = [...result.values, ...result.comparison];
  const minimum = Math.min(0, ...all);
  const maximum = Math.max(1, ...all);
  const plotY = (value: number) => 200 - ((value - minimum) / (maximum - minimum)) * 176;
  const points = (values: number[]) =>
    values.map((value, index) => `${24 + (index / (values.length - 1)) * 352},${plotY(value)}`).join(" ");
  return (
    <Stack gap="xs">
      <HStack justify="space-between" textStyle="label/XS/regular" color="fg.muted">
        <Text>{formatMoney(minimum)}</Text>
        <Text>{formatMoney(maximum)}</Text>
      </HStack>
      <chakra.svg
        css={styles.plot}
        viewBox="0 0 400 224"
        role="img"
        aria-label={`${result.chartLabel} over ${years} years`}
      >
        <chakra.path css={styles.plotGrid} d="M24 24H376 M24 112H376 M24 200H376 M24 24V200 M200 24V200 M376 24V200" />
        <chakra.path css={styles.plotGrid} d={`M24 ${plotY(0)}H376`} />
        <chakra.polyline css={styles.plotComparison} points={points(result.comparison)} />
        <chakra.polyline css={styles.plotCurve} points={points(result.values)} />
        <chakra.circle css={styles.plotPoint} cx="376" cy={plotY(result.values.at(-1)!)} r="5" />
      </chakra.svg>
      <HStack justify="space-between" textStyle="label/XS/regular" color="fg.muted">
        <Text>Today</Text>
        <Text>Year {years}</Text>
      </HStack>
      <HStack gap="md" flexWrap="wrap" textStyle="label/XS/regular">
        <Text color="fg.info">━ {result.chartLabel}</Text>
        <Text color="fg.muted">┄ {result.comparisonLabel}</Text>
      </HStack>
    </Stack>
  );
};
