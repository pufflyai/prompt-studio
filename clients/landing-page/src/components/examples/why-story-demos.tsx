import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useToolDemoStyles } from "../../hooks/use-landing-styles";
import { BlockSymbol } from "../sections/building-blocks";
import { AgentDashboardDemo } from "./agent-dashboard-demo";
import { DemoWorkbench } from "./demo-workbench";
import { FormulaGlossaryDemo } from "./formula-glossary-demo";
import { IconSetEditorDemo } from "./icon-set-editor-demo";

export const ConnectedToolsDemo = () => (
  <DemoWorkbench>
    <AgentDashboardDemo />
  </DemoWorkbench>
);

export const ChangeToolDemo = () => {
  const [changed, setChanged] = useState(false);
  const styles = useToolDemoStyles();
  return (
    <Stack gap="md">
      <Box css={styles.prompt}>
        <HStack gap="sm" flex="1">
          <BlockSymbol kind="skill" />
          <Text>Let me adjust the inputs and see the result on the curve.</Text>
        </HStack>
        <Button
          variant={changed ? "outline" : "primary"}
          size="lg"
          flexShrink="0"
          aria-pressed={changed}
          onClick={() => setChanged(!changed)}
        >
          {changed ? "Undo change" : "Try the change"}
          <ArrowRight />
        </Button>
      </Box>
      <DemoWorkbench>
        <FormulaGlossaryDemo interactive={changed} />
      </DemoWorkbench>
    </Stack>
  );
};

export const WorkbenchOverviewDemo = () => (
  <DemoWorkbench>
    <IconSetEditorDemo />
  </DemoWorkbench>
);
