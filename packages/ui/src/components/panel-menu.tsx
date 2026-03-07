import { Flex, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

type PanelMenuVariant = "default" | "compact";

const panelMenuVariantStyles = {
  default: {
    width: "64" as const,
    headerHeight: "49px",
    headerPadding: "xs" as const,
    headerTextStyle: "label/L/medium",
    contentPadding: "xs" as const,
    contentGap: "xs" as const,
  },
  compact: {
    width: "64" as const,
    headerHeight: "49px",
    headerPadding: "xs" as const,
    headerTextStyle: "label/L/medium",
    contentPadding: "2xs" as const,
    contentGap: "2xs" as const,
  },
} as const;

interface PanelMenuProps {
  title: string;
  children?: ReactNode;
  variant?: PanelMenuVariant;
}

export function PanelMenu(props: PanelMenuProps) {
  const { title, children, variant = "default" } = props;
  const styles = panelMenuVariantStyles[variant];

  return (
    <Stack borderRightWidth="1px" width={styles.width} gap="0" minH="0">
      {title && (
        <Flex height={styles.headerHeight} p={styles.headerPadding} borderBottomWidth="1px" alignItems="center">
          <Text pb="0" textStyle={styles.headerTextStyle} color="fg.muted">
            {title}
          </Text>
        </Flex>
      )}

      {children && (
        <Stack p={styles.contentPadding} gap={styles.contentGap} flex="1" minH="0" overflowY="auto">
          {children}
        </Stack>
      )}
    </Stack>
  );
}
