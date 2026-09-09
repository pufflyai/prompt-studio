import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { useRef, useState } from "react";
import { blockFor } from "../../content/building-block-content";
import { TOOL_EXAMPLES } from "../../content/tool-examples-content";
import type { ToolShapeKind } from "../../content/tool-shapes";
import { useStoryStyles } from "../../hooks/use-landing-styles";
import { DemoWorkbench } from "../examples/demo-workbench";
import { ToolDemo } from "../examples/tool-demo";
import { PageScroll } from "../workbench/page-scroll";
import { BlockChip, BuildingBlocks } from "./building-blocks";
import { WorkbenchServices } from "./workbench-services";

export const FeaturesView = () => {
  const exampleRef = useRef<HTMLDivElement>(null);
  const [exampleId, setExampleId] = useState(TOOL_EXAMPLES[0].id);
  const [selectedBlock, setSelectedBlock] = useState<ToolShapeKind>("page");
  const example = TOOL_EXAMPLES.find((item) => item.id === exampleId)!;
  const contribution = example.blocks.find((block) => block.kind === selectedBlock)!;
  const styles = useStoryStyles();

  const selectBlock = (kind: ToolShapeKind) => {
    setSelectedBlock(kind);
    if (!example.blocks.some((block) => block.kind === kind)) {
      setExampleId(TOOL_EXAMPLES.find((item) => item.blocks.some((block) => block.kind === kind))!.id);
    }
  };

  return (
    <PageScroll>
      <Box css={styles.page}>
        <Box ref={exampleRef} css={styles.section} as="section" aria-labelledby="tool-examples-title">
          <Stack css={styles.intro}>
            <Text id="tool-examples-title" as="h1" textStyle={{ base: "heading/M", md: "heading/L" }}>
              What will you build?
            </Text>
          </Stack>
          <HStack gap="xs" flexWrap="wrap" role="group" aria-label="Example tools">
            {TOOL_EXAMPLES.map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                aria-pressed={exampleId === item.id}
                onClick={() => {
                  setExampleId(item.id);
                  setSelectedBlock("page");
                }}
              >
                {item.name}
              </Button>
            ))}
          </HStack>
          <DemoWorkbench name={example.name}>
            <ToolDemo key={example.id} example={example.id} highlighted={selectedBlock} />
          </DemoWorkbench>
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
                  onClick={() => selectBlock(block.kind)}
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
        </Box>
        <BuildingBlocks
          selected={selectedBlock}
          onSelect={(kind) => {
            selectBlock(kind);
            exampleRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
          }}
        />
        <WorkbenchServices />
      </Box>
    </PageScroll>
  );
};
