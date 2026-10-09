import { Box, Icon, Text } from "@chakra-ui/react";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";
import type { ToolShapeKind } from "../../content/tool-shapes";
import { useDemoComposition } from "../../hooks/use-demo-composition";
import { useStoryStyles } from "../../hooks/use-landing-styles";
import { BlockSymbol } from "../sections/building-blocks";

interface DemoPanelProps {
  title: string;
  kind: ToolShapeKind;
  highlighted?: ToolShapeKind;
  children: ReactNode;
}

export const DemoPanel = (props: DemoPanelProps) => {
  const { title, kind, highlighted, children } = props;
  const styles = useStoryStyles();
  const composition = useDemoComposition();
  return (
    <Box
      hidden={Boolean(composition && !composition.parts.includes(kind))}
      css={styles.panel}
      data-demo-part={kind}
      data-highlighted={kind === highlighted}
    >
      <Box css={styles.panelHeader}>
        <BlockSymbol kind={kind} />
        <Text flex="1" visibility={composition && !composition.complete ? "hidden" : undefined}>
          {title}
        </Text>
        <Icon as={GripVertical} boxSize="icon-sm" color="fg.subtle" />
      </Box>
      <Box css={styles.panelBody}>{children}</Box>
    </Box>
  );
};

export const DemoWorkbench = (props: { children: ReactNode }) => {
  const { children } = props;
  const styles = useStoryStyles();
  return <Box css={styles.visual}>{children}</Box>;
};
