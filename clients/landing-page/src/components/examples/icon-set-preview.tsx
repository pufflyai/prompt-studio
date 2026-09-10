import { Box, Text } from "@chakra-ui/react";
import type { ExampleIcon } from "../../content/icon-set-content";
import { useToolDemoStyles } from "../../hooks/use-landing-styles";

export type PreviewIconState = "pending" | "active" | "ready";

export const IconSetPreview = (props: { icons: (ExampleIcon & { state: PreviewIconState })[] }) => {
  const { icons } = props;
  const styles = useToolDemoStyles();
  return (
    <Box css={styles.iconGrid} as="ul" aria-label="Icon set preview">
      {icons.map((item) => (
        <Box as="li" css={styles.iconTile} key={item.id} data-state={item.state}>
          <Box css={styles.tileSymbol}>
            <item.icon />
          </Box>
          <Text css={styles.iconName}>{item.name}</Text>
          <Text textStyle="mono/XS" color="fg.muted">
            U+{item.codepoint}
          </Text>
        </Box>
      ))}
    </Box>
  );
};
