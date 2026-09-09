import { Box, Button, Code, HStack, Stack, Text } from "@chakra-ui/react";
import { Bot, Check, Terminal } from "lucide-react";
import { useState } from "react";
import type { ExampleFormula } from "../../content/formula-glossary-content";
import type { ToolShapeKind } from "../../content/tool-shapes";
import { executeFormulaCommand, type FormulaValues } from "../../services/financial-formulas";
import { DemoPanel } from "./demo-workbench";

interface FormulaCommandDemoProps {
  formula: ExampleFormula;
  inputs: FormulaValues;
  highlighted?: ToolShapeKind;
}

export const FormulaCommandDemo = (props: FormulaCommandDemoProps) => {
  const { formula, inputs, highlighted } = props;
  const [execution, setExecution] = useState<ReturnType<typeof executeFormulaCommand> | null>(null);
  const values = execution?.arguments ?? inputs;
  return (
    <DemoPanel title="Agent session" kind="command" highlighted={highlighted}>
      <Text textStyle="paragraph/M/regular">{formula.question(values)}</Text>
      <Button
        variant="subtle"
        alignSelf="start"
        onClick={() => setExecution(executeFormulaCommand(formula.id, inputs))}
      >
        <Bot />
        {execution ? "Ask again" : "Ask agent"}
      </Button>
      {execution && (
        <Stack gap="md" aria-live="polite">
          <HStack gap="sm">
            <Terminal size={16} />
            <Text textStyle="label/S/medium">Called {execution.command}</Text>
            <Check size={14} />
          </HStack>
          <Code as="pre" p="md" overflowX="auto">
            {JSON.stringify(execution.arguments, null, 2)}
          </Code>
          <Box role="status">
            <Text textStyle="paragraph/M/regular">{formula.answer(execution.arguments, execution.result)}</Text>
          </Box>
        </Stack>
      )}
    </DemoPanel>
  );
};
