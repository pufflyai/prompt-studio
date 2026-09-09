import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { Slider } from "@pstdio/ui";
import { useState } from "react";
import { EXAMPLE_FORMULAS, formatMoney } from "../../content/formula-glossary-content";
import type { ToolShapeKind } from "../../content/tool-shapes";
import { useStoryStyles, useToolDemoStyles } from "../../hooks/use-landing-styles";
import { DemoPanel } from "./demo-workbench";
import { FormulaPlot } from "./formula-plot";

export const FormulaGlossaryDemo = (props: { highlighted?: ToolShapeKind }) => {
  const { highlighted } = props;
  const [selected, setSelected] = useState(EXAMPLE_FORMULAS[0].id);
  const [inputs, setInputs] = useState({ principal: 10000, rate: 5, years: 10 });
  const formula = EXAMPLE_FORMULAS.find((item) => item.id === selected)!;
  const story = useStoryStyles();
  const styles = useToolDemoStyles();
  const controls = [
    {
      key: "principal",
      label: "Starting amount",
      value: formatMoney(inputs.principal),
      min: 1000,
      max: 50000,
      step: 1000,
    },
    { key: "rate", label: formula.rateLabel, value: `${inputs.rate}%`, min: 0, max: 15, step: 0.5 },
    { key: "years", label: "Time", value: `${inputs.years} years`, min: 1, max: 30, step: 1 },
  ] as const;

  return (
    <Box css={story.panels}>
      <DemoPanel title="Financial formulas" kind="page" highlighted={highlighted}>
        <Box css={styles.sessions} role="group" aria-label="Choose a formula">
          {EXAMPLE_FORMULAS.map((item) => (
            <Box
              as="button"
              key={item.id}
              css={styles.session}
              aria-pressed={item.id === selected}
              onClick={() => setSelected(item.id)}
            >
              <Text textStyle="label/M/medium">{item.name}</Text>
              <Text textStyle="heading/S" color="fg.muted">
                {item.equation}
              </Text>
            </Box>
          ))}
        </Box>
        <Text textStyle="label/S/regular" color="fg.muted">
          P = starting amount · r = annual rate · t = years
        </Text>
      </DemoPanel>
      <DemoPanel title={formula.name} kind="editor" highlighted={highlighted}>
        <Stack gap="xs">
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {formula.description}
          </Text>
          <Text textStyle="label/S/regular" color="fg.muted">
            {formula.resultLabel}
          </Text>
          <Text as="output" aria-label="Formula result" textStyle="heading/L">
            {formatMoney(formula.evaluate(inputs))}
          </Text>
        </Stack>
        <FormulaPlot formula={formula} inputs={inputs} />
        <Stack gap="lg">
          {controls.map((control) => (
            <Stack key={control.key} gap="sm">
              <HStack justify="space-between" textStyle="label/S/regular">
                <Text>{control.label}</Text>
                <Text>{control.value}</Text>
              </HStack>
              <Slider
                aria-label={[control.label]}
                min={control.min}
                max={control.max}
                step={control.step}
                value={[inputs[control.key]]}
                onValueChange={({ value }) => setInputs((current) => ({ ...current, [control.key]: value[0] }))}
              />
            </Stack>
          ))}
        </Stack>
      </DemoPanel>
    </Box>
  );
};
