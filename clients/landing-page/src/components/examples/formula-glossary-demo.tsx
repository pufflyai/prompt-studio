import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { Slider } from "@pstdio/ui";
import { useState } from "react";
import { EXAMPLE_FORMULAS } from "../../content/formula-glossary-content";
import type { ToolShapeKind } from "../../content/tool-shapes";
import { useStoryStyles, useToolDemoStyles } from "../../hooks/use-landing-styles";
import { calculateFormula, formatMoney } from "../../services/financial-formulas";
import { DemoPanel } from "./demo-workbench";
import { FormulaCommandDemo } from "./formula-command-demo";
import { FormulaPlot } from "./formula-plot";

export const FormulaGlossaryDemo = (props: { highlighted?: ToolShapeKind }) => {
  const { highlighted } = props;
  const [selection, setSelection] = useState({ id: EXAMPLE_FORMULAS[0].id, inputs: EXAMPLE_FORMULAS[0].defaults });
  const { inputs } = selection;
  const formula = EXAMPLE_FORMULAS.find((item) => item.id === selection.id)!;
  const result = calculateFormula(formula.id, inputs);
  const story = useStoryStyles();
  const styles = useToolDemoStyles();
  return (
    <Stack gap="panel-gap">
      <Box css={story.panels}>
        <DemoPanel title="Financial formulas" kind="page" highlighted={highlighted}>
          <Box css={styles.sessions} role="group" aria-label="Choose a formula">
            {EXAMPLE_FORMULAS.map((item) => (
              <Box
                as="button"
                key={item.id}
                css={styles.session}
                aria-pressed={item.id === formula.id}
                onClick={() => setSelection({ id: item.id, inputs: item.defaults })}
              >
                <Text textStyle="label/M/medium">{item.name}</Text>
                <Text textStyle="mono/XS" overflowWrap="anywhere" color="fg.muted">
                  {item.equation}
                </Text>
              </Box>
            ))}
          </Box>
          <Stack gap="lg">
            {formula.controls.map((control) => {
              let value = `${inputs[control.key]} years`;
              if (control.unit === "money") value = formatMoney(inputs[control.key]);
              if (control.unit === "percent") value = `${inputs[control.key]}%`;
              return (
                <Stack key={control.key} gap="sm">
                  <HStack justify="space-between" textStyle="label/S/regular">
                    <Text>{control.label}</Text>
                    <Text>{value}</Text>
                  </HStack>
                  <Slider
                    aria-label={[control.label]}
                    min={control.min}
                    max={control.max}
                    step={control.step}
                    value={[inputs[control.key]]}
                    onValueChange={({ value }) =>
                      setSelection((current) => ({
                        ...current,
                        inputs: { ...current.inputs, [control.key]: value[0] },
                      }))
                    }
                  />
                </Stack>
              );
            })}
          </Stack>
        </DemoPanel>
        <DemoPanel title={formula.name} kind="editor" highlighted={highlighted}>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {formula.description}
          </Text>
          <Stack gap="xs">
            <Text textStyle="label/S/regular" color="fg.muted">
              {formula.resultLabel}
            </Text>
            <Text as="output" aria-label="Formula result" textStyle="heading/L">
              {formatMoney(result.value)}
            </Text>
          </Stack>
          <FormulaPlot result={result} years={inputs.years} />
          <Stack gap="md">
            {result.metrics.map((metric) => (
              <HStack key={metric.label} justify="space-between" gap="sm" flexWrap="wrap">
                <Text textStyle="label/S/regular" color="fg.muted">
                  {metric.label}
                </Text>
                <Text textStyle="label/M/medium">{formatMoney(metric.value)}</Text>
              </HStack>
            ))}
          </Stack>
        </DemoPanel>
      </Box>
      <FormulaCommandDemo key={formula.id} formula={formula} inputs={inputs} highlighted={highlighted} />
    </Stack>
  );
};
