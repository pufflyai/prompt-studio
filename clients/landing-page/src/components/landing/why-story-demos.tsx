import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { AgentDashboardDemo } from "./agent-dashboard-demo";
import { BlockSymbol, useStoryStyles } from "./building-blocks";
import { DemoWorkbench, useToolDemoStyles } from "./demo-workbench";
import { FontEditorDemo } from "./font-editor-demo";

export const ConnectedToolsDemo = () => {
  const styles = useStoryStyles();
  return (
    <Stack gap="md">
      <Box css={styles.flow} textStyle="label/S/regular">
        <HStack gap="xs">
          <BlockSymbol kind="editor" />
          <Text>Edit font</Text>
        </HStack>
        <ArrowRight size={14} aria-hidden="true" />
        <HStack gap="xs">
          <BlockSymbol kind="command" />
          <Text>Build font</Text>
        </HStack>
        <ArrowRight size={14} aria-hidden="true" />
        <HStack gap="xs">
          <BlockSymbol kind="page" />
          <Text>Preview</Text>
        </HStack>
      </Box>
      <DemoWorkbench name="Coding agents">
        <AgentDashboardDemo />
      </DemoWorkbench>
    </Stack>
  );
};

export const ChangeToolDemo = () => {
  const [changed, setChanged] = useState(false);
  const styles = useToolDemoStyles();
  return (
    <Stack gap="md">
      <Box css={styles.prompt}>
        <HStack gap="sm" flex="1">
          <BlockSymbol kind="skill" />
          <Text>Show previews of what each agent is building.</Text>
        </HStack>
        <Button aria-pressed={changed} onClick={() => setChanged(!changed)}>
          {changed ? "Undo change" : "Try the change"}
        </Button>
      </Box>
      <DemoWorkbench name="Your agent dashboard">
        <AgentDashboardDemo withPreview={changed} />
      </DemoWorkbench>
    </Stack>
  );
};

export const WorkbenchOverviewDemo = () => (
  <DemoWorkbench name="Font editor">
    <FontEditorDemo />
  </DemoWorkbench>
);
