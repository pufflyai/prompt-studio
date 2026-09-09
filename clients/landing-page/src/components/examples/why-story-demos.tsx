import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useToolDemoStyles } from "../../hooks/use-landing-styles";
import { BlockSymbol } from "../sections/building-blocks";
import { AgentWorkflowDemo } from "./agent-workflow-demo";
import { DemoWorkbench } from "./demo-workbench";
import { IconSetEditorDemo } from "./icon-set-editor-demo";
import { ShaderEditorDemo } from "./shader-editor-demo";

export const ConnectedToolsDemo = () => (
  <DemoWorkbench>
    <AgentWorkflowDemo />
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
          <Text>Add sliders to adjust the scale and speed.</Text>
        </HStack>
        <Button variant="subtle" size="lg" flexShrink="0" aria-pressed={changed} onClick={() => setChanged(!changed)}>
          {changed ? "Undo change" : "Try the change"}
          <ArrowRight />
        </Button>
      </Box>
      <DemoWorkbench>
        <ShaderEditorDemo withControls={changed} />
      </DemoWorkbench>
    </Stack>
  );
};

export const WorkbenchOverviewDemo = () => (
  <DemoWorkbench>
    <IconSetEditorDemo />
  </DemoWorkbench>
);
