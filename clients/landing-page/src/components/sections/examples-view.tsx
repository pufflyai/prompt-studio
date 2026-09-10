import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { blockFor } from "../../content/building-block-content";
import { TOOL_EXAMPLES, type ToolExampleId } from "../../content/tool-examples-content";
import type { ToolShapeKind } from "../../content/tool-shapes";
import { useStoryStyles } from "../../hooks/use-landing-styles";
import { landingPathForExample } from "../../services/landing-route";
import { DemoWorkbench } from "../examples/demo-workbench";
import { ToolDemo } from "../examples/tool-demo";
import { PageScroll } from "../workbench/page-scroll";
import { BlockChip } from "./building-blocks";

interface ExamplesViewProps {
  exampleId: ToolExampleId;
  onNavigate: (exampleId: ToolExampleId) => void;
}

export const ExamplesView = (props: ExamplesViewProps) => {
  const { exampleId, onNavigate } = props;
  const [selectedBlock, setSelectedBlock] = useState<ToolShapeKind>("page");
  const example = TOOL_EXAMPLES.find((item) => item.id === exampleId)!;
  const contribution = example.blocks.find((block) => block.kind === selectedBlock)!;
  const styles = useStoryStyles();

  return (
    <PageScroll>
      <Box css={styles.page}>
        <Box css={styles.section} as="section" aria-labelledby="tool-examples-title">
          <Stack css={styles.intro}>
            <Text id="tool-examples-title" as="h1" textStyle={{ base: "heading/M", md: "heading/L" }}>
              {example.name}
            </Text>
          </Stack>
          <HStack gap="xs" flexWrap="wrap" as="nav" aria-label="Example tools">
            {TOOL_EXAMPLES.map((item) => (
              <Button key={item.id} asChild variant="ghost" data-active={exampleId === item.id ? "" : undefined}>
                <a
                  href={landingPathForExample(item.id)}
                  aria-current={exampleId === item.id ? "page" : undefined}
                  onClick={(event) => {
                    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    onNavigate(item.id);
                  }}
                >
                  {item.name}
                </a>
              </Button>
            ))}
          </HStack>
          <Text textStyle="paragraph/M/regular" color="fg.muted" aria-live="polite">
            {example.description}
          </Text>
          <Box css={styles.composition}>
            <Text textStyle="label/S/regular" color="fg.muted">
              Made with
            </Text>
            <HStack gap="sm" flexWrap="wrap">
              {example.blocks.map((block) => (
                <BlockChip
                  key={block.kind}
                  kind={block.kind}
                  selected={block.kind === selectedBlock}
                  onClick={() => setSelectedBlock(block.kind)}
                />
              ))}
            </HStack>
            <Text textStyle="paragraph/M/regular" aria-live="polite">
              <Text as="span" textStyle="label/M/medium">
                {blockFor(selectedBlock).name}.{" "}
              </Text>
              {contribution.purpose}
            </Text>
          </Box>
          <DemoWorkbench>
            <ToolDemo key={example.id} example={example.id} highlighted={selectedBlock} />
          </DemoWorkbench>
        </Box>
      </Box>
    </PageScroll>
  );
};
