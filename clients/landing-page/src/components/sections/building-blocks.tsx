import { Box, Text } from "@chakra-ui/react";
import { BUILDING_BLOCKS } from "../../content/building-block-content";
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

export const BuildingBlocks = () => {
  const styles = useStoryStyles();
  return (
    <Box css={styles.blockGrid}>
      {BUILDING_BLOCKS.map((block) => (
        <Box key={block.kind} css={styles.block}>
          <Box css={styles.blockSymbol}>
            <BlockSymbol kind={block.kind} large />
          </Box>
          <Text as="h3" textStyle="heading/S">
            {block.name}
          </Text>
          <Text textStyle="paragraph/M/regular">{block.detail}</Text>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {block.example}
          </Text>
        </Box>
      ))}
    </Box>
  );
};
