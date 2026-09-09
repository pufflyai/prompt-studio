import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { BUILDING_BLOCKS, blockFor } from "../../content/building-block-content";
import type { ToolShapeKind } from "../../content/tool-shapes";
import { useStoryStyles } from "../../hooks/use-landing-styles";
import { ToolShape } from "../shapes/tool-shapes";

export const BlockSymbol = (props: { kind: ToolShapeKind; large?: boolean }) => {
  const { kind, large = false } = props;
  const styles = useStoryStyles();
  const size = large ? 40 : 16;
  const height = kind === "command" ? size / 2 : size;
  const fullHeight = large ? "10" : "4";
  const halfHeight = large ? "5" : "2";
  return (
    <Box as="span" css={styles.blockMark} height={kind === "command" ? halfHeight : fullHeight}>
      <ToolShape kind={kind} size={height} />
    </Box>
  );
};

interface BlockChipProps {
  kind: ToolShapeKind;
  selected?: boolean;
  onClick?: () => void;
}

export const BlockChip = (props: BlockChipProps) => {
  const { kind, selected, onClick } = props;
  const content = (
    <>
      <BlockSymbol kind={kind} />
      <Text textStyle="label/S/medium">{blockFor(kind).name}</Text>
    </>
  );
  if (onClick)
    return (
      <Button variant="ghost" size="sm" aria-pressed={selected} onClick={onClick}>
        {content}
      </Button>
    );
  return <HStack gap="xs">{content}</HStack>;
};

export const BuildingBlocks = (props: { selected: ToolShapeKind; onSelect: (kind: ToolShapeKind) => void }) => {
  const { selected, onSelect } = props;
  const styles = useStoryStyles();
  return (
    <Box css={styles.section} as="section" aria-labelledby="building-blocks-title">
      <Stack gap="sm">
        <Text id="building-blocks-title" as="h2" textStyle="heading/M">
          Choose the pieces your tool needs.
        </Text>
        <Text textStyle="paragraph/M/regular" color="fg.muted">
          Combine building blocks in an extension. Each shape is a different kind of building block.
        </Text>
      </Stack>
      <Box css={styles.blockGrid}>
        {BUILDING_BLOCKS.map((block) => (
          <Box
            key={block.kind}
            as="button"
            css={styles.block}
            aria-pressed={selected === block.kind}
            onClick={() => onSelect(block.kind)}
          >
            <Box css={styles.blockSymbol}>
              <BlockSymbol kind={block.kind} large />
            </Box>
            <Text as="span" textStyle="heading/S">
              {block.name}
            </Text>
            <Text textStyle="paragraph/M/regular">{block.detail}</Text>
            <Text textStyle="paragraph/S/regular" color="fg.muted">
              {block.example}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
