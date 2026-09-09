import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { Slider } from "@pstdio/ui";
import { useState } from "react";
import { EXAMPLE_FORMULAS } from "../../content/formula-glossary-content";
import type { ToolShapeKind } from "../../content/tool-shapes";
import { useStoryStyles, useToolDemoStyles } from "../../hooks/use-landing-styles";
import { DemoPanel } from "./demo-workbench";
import { FormulaPlot } from "./formula-plot";

export const FormulaGlossaryDemo = (props: { highlighted?: ToolShapeKind; interactive?: boolean }) => {
  const { highlighted, interactive = true } = props;
  const [selected, setSelected] = useState(EXAMPLE_FORMULAS[0].id);
  const [input, setInput] = useState(0.25);
  const formula = EXAMPLE_FORMULAS.find((item) => item.id === selected)!;
  const result = Math.round(formula.evaluate(input) * 100) / 100;
  const story = useStoryStyles();
  const styles = useToolDemoStyles();

  return (
    <Box css={story.panels}>
      <DemoPanel title="Your formulas" kind="page" highlighted={highlighted}>
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
              <Text textStyle="heading/M" color="fg.muted">
                {item.equation}
              </Text>
            </Box>
          ))}
        </Box>
      </DemoPanel>
      <DemoPanel title={formula.name} kind="editor" highlighted={highlighted}>
        <Stack gap="xs">
          <Text textStyle="heading/M">{formula.equation}</Text>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {formula.description}
          </Text>
        </Stack>
        <FormulaPlot formula={formula} input={interactive ? input : undefined} />
        {interactive && (
          <Stack gap="md">
            <HStack css={styles.toolbar} textStyle="mono/XS">
              <Text>Input x = {input.toFixed(2)}</Text>
              <Text as="output" aria-label="Formula result">
                y = {result.toFixed(2)}
              </Text>
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
        <Text textStyle="mono/XS" color="fg.muted">
          {formula.expression}
        </Text>
      </DemoPanel>
    </Box>
  );
};
