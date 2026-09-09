import { chakra } from "@chakra-ui/react";
import type { ExampleFormula } from "../../content/formula-glossary-content";
import { useToolDemoStyles } from "../../hooks/use-landing-styles";

const plotX = (x: number) => 24 + x * 352;
const plotY = (y: number) => 112 - y * 88;

export const FormulaPlot = (props: { formula: ExampleFormula; input?: number }) => {
  const { formula, input } = props;
  const styles = useToolDemoStyles();
  const points = Array.from({ length: 101 }, (_, index) => {
    const x = index / 100;
    return `${plotX(x)},${plotY(formula.evaluate(x))}`;
  }).join(" ");

  return (
    <chakra.svg css={styles.plot} viewBox="0 0 400 224" role="img" aria-label={`${formula.name} curve`}>
      <chakra.path css={styles.plotGrid} d="M24 24H376 M24 112H376 M24 200H376 M24 24V200 M200 24V200 M376 24V200" />
      <chakra.polyline css={styles.plotCurve} points={points} />
      {input !== undefined && (
        <>
          <chakra.path css={styles.plotCursor} d={`M${plotX(input)} 24V200`} />
          <chakra.circle css={styles.plotPoint} cx={plotX(input)} cy={plotY(formula.evaluate(input))} r="5" />
        </>
      )}
    </chakra.svg>
  );
};
