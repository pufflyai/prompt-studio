import { Box, Flex, type FlexProps, Icon, IconButton, Stack, type StackProps, Text } from "@chakra-ui/react";
import { PanelRightClose } from "lucide-react";
import type { ReactNode } from "react";
import { ContentPlaceholder } from "./content-placeholder";
import { HorizontalMenuStack } from "./horizontal-menu-stack";
import { ScrollArea } from "./scroll-area";

interface DrawerInlineProps extends FlexProps {
  open?: boolean;
  children?: FlexProps["children"];
  width?: FlexProps["width"];
}

export function DrawerInline(props: DrawerInlineProps) {
  const { open, width, children, ...rest } = props;

  if (!open) return null;

  return (
    <Flex height="100%" width={width} maxW="100%" bg="bg" {...rest}>
      <Box width="8px" height="100%" borderRightWidth={"1px"}>
        <ContentPlaceholder height="100%" />
      </Box>
      <Stack flex="1" minH="0" gap="0">
        {children}
      </Stack>
    </Flex>
  );
}

interface DrawerInlineHeaderProps extends StackProps {
  title?: string;
  actions?: ReactNode;
  onClose?: () => void;
  children?: StackProps["children"];
}

export function DrawerInlineHeader(props: DrawerInlineHeaderProps) {
  const { title, actions, onClose, children, ...rest } = props;

  return (
    <HorizontalMenuStack {...rest} gap="sm" px="sm" py="xs" alignItems="center" borderBottomWidth="1px" bg="bg">
      {onClose ? (
        <IconButton onClick={onClose} aria-label="Close preview" variant="ghost" size="sm">
          <Icon as={PanelRightClose} boxSize="16px" />
        </IconButton>
      ) : null}

      <Flex align="center" gap="xs" minW="0" flex="1">
        {title ? (
          <Text textStyle="paragraph/M/medium" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
            {title}
          </Text>
        ) : null}
        {children}
      </Flex>

      <Flex align="center" gap="xs" flexWrap="wrap" justify="flex-end">
        {actions}
      </Flex>
    </HorizontalMenuStack>
  );
}

interface DrawerInlineBodyProps extends FlexProps {
  children?: FlexProps["children"];
}

export function DrawerInlineBody(props: DrawerInlineBodyProps) {
  const { children, ...rest } = props;

  return (
    <Flex {...rest} direction="column" flex="1" minH="0" gap="0" borderWidth="0">
      <ScrollArea flex="1" minH="0" contentProps={{ display: "flex", flexDirection: "column", gap: "sm" }}>
        {children}
      </ScrollArea>
    </Flex>
  );
}

interface DrawerInlineFooterProps extends FlexProps {
  children?: FlexProps["children"];
}

export function DrawerInlineFooter(props: DrawerInlineFooterProps) {
  const { children, ...rest } = props;

  return (
    <Flex {...rest} justify="flex-end" align="center" gap="xs" px="sm" py="xs" borderTopWidth="1px" bg="bg">
      {children}
    </Flex>
  );
}
