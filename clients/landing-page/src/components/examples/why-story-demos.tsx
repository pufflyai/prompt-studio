import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useStoryStyles, useToolDemoStyles } from "../../hooks/use-landing-styles";
import { BlockSymbol } from "../sections/building-blocks";
import { AgentDashboardDemo } from "./agent-dashboard-demo";
import { DemoWorkbench } from "./demo-workbench";
import { IconSetEditorDemo } from "./icon-set-editor-demo";

export const ConnectedToolsDemo = () => {
  const styles = useStoryStyles();
  return (
    <Stack gap="md">
      <Box css={styles.flow} textStyle="label/S/regular">
        <HStack gap="xs">
          <BlockSymbol kind="editor" />
          <Text>Edit icons</Text>
        </HStack>
        <ArrowRight size={14} aria-hidden="true" />
        <HStack gap="xs">
          <BlockSymbol kind="command" />
          <Text>Build icon set</Text>
        </HStack>
        <ArrowRight size={14} aria-hidden="true" />
        <HStack gap="xs">
          <BlockSymbol kind="page" />
          <Text>Preview</Text>
        </HStack>
      </Box>
      <DemoWorkbench>
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
      <DemoWorkbench>
        <AgentDashboardDemo withPreview={changed} />
      </DemoWorkbench>
    </Stack>
  );
};

export const WorkbenchOverviewDemo = () => (
  <DemoWorkbench>
    <IconSetEditorDemo />
  </DemoWorkbench>
);
