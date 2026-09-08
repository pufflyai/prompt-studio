import { Box, Icon, Text, useSlotRecipe } from "@chakra-ui/react";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";
import type { ToolShapeKind } from "../shapes/tool-shapes";
import { BlockSymbol, useStoryStyles } from "./building-blocks";

export const useToolDemoStyles = () => useSlotRecipe({ key: "landingToolDemo" })({});

interface DemoPanelProps {
  title: string;
  kind: ToolShapeKind;
  highlighted?: ToolShapeKind;
  children: ReactNode;
}

export const DemoPanel = (props: DemoPanelProps) => {
  const { title, kind, highlighted, children } = props;
  const styles = useStoryStyles();
  return (
    <Box css={styles.panel} data-highlighted={kind === highlighted}>
      <Box css={styles.panelHeader}>
        <BlockSymbol kind={kind} />
        <Text flex="1">{title}</Text>
        <Icon as={GripVertical} boxSize="icon-sm" color="fg.subtle" />
      </Box>
      <Box css={styles.panelBody}>{children}</Box>
    </Box>
  );
};

export const DemoWorkbench = (props: { children: ReactNode; name: string }) => {
  const { children, name } = props;
  const styles = useStoryStyles();
  return (
    <Box css={styles.visual}>
      <Box css={styles.visualHeader}>
        <Text>{name}</Text>
        <Text>Interactive example</Text>
      </Box>
      {children}
    </Box>
  );
};
