import { Box, Stack, Text } from "@chakra-ui/react";
import type { ToolExampleId } from "../../content/tool-examples-content";
import { useStoryStyles } from "../../hooks/use-landing-styles";
import { ToolRecording } from "../examples/tool-recording";

interface ExamplesViewProps {
  exampleId: ToolExampleId;
  onNavigate: (exampleId: ToolExampleId, replace?: boolean) => void;
}

export const ExamplesView = (props: ExamplesViewProps) => {
  const { exampleId, onNavigate } = props;
  const styles = useStoryStyles();
  return (
    <Box css={styles.page} data-studio-section="examples">
      <Box as="section" css={styles.section} aria-labelledby="tool-examples-title">
        <Stack css={styles.intro}>
          <Text id="tool-examples-title" as="h1" textStyle={{ base: "heading/L", md: "heading/XL" }}>
            What will you build?
          </Text>
          <Text textStyle="paragraph/L/regular" color="fg.muted">
            A ticket board, an image editor, a UI editor, a 3D preview. Each one is a request away, and they all live in
            one app.
          </Text>
        </Stack>
        <ToolRecording start={exampleId} onSelect={(id) => onNavigate(id, true)} />
      </Box>
    </Box>
  );
};
