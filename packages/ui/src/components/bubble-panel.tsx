import { Box, chakra, Flex, HStack, type HTMLChakraProps, IconButton, Portal, Spacer } from "@chakra-ui/react";
import { Minus, SquareArrowOutUpRight } from "lucide-react";
import { forwardRef, type ReactNode } from "react";
import { Header } from "./header";
import { Tooltip } from "./tooltip";

export interface BubblePanelProps {
  isOpen?: boolean;
  title?: string;
  menu?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  onPopOut?: (() => void) | null;
  popOutLabel?: string;
  width?: string;
  height?: string;
  containerProps?: HTMLChakraProps<"section">;
  testId?: string;
  "aria-label"?: string;
  children?: ReactNode;
}

export const BubblePanel = forwardRef<HTMLDivElement, BubblePanelProps>(function BubblePanel(props, ref) {
  const {
    isOpen = false,
    title,
    menu,
    onClose,
    closeLabel,
    onPopOut,
    popOutLabel,
    width = "28rem",
    height = "38rem",
    containerProps,
    testId,
    "aria-label": ariaLabel,
    children,
  } = props;

  if (!isOpen) return null;

  return (
    <Portal>
      <chakra.section
        ref={ref}
        role="dialog"
        data-testid={testId}
        aria-label={ariaLabel ?? title}
        position="fixed"
        bottom="3"
        right="3"
        w={width}
        maxW="calc(100vw - 2rem)"
        h={height}
        maxH="calc(100vh - 2rem)"
        borderRadius="3xl"
        borderWidth="1px"
        borderColor="border.subtle"
        boxShadow="2xl"
        bg="bg"
        overflow="hidden"
        zIndex="dropdown"
        {...containerProps}
      >
        <Flex direction="column" h="full">
          <Header variant="main" gap="sm" flexShrink={0}>
            <HStack gap="1" minW="0">
              {menu}
            </HStack>
            <Spacer />
            <HStack gap="1">
              {onPopOut ? (
                <Tooltip content={popOutLabel}>
                  <IconButton size="xs" variant="ghost" aria-label={popOutLabel} onClick={onPopOut}>
                    <SquareArrowOutUpRight size={16} />
                  </IconButton>
                </Tooltip>
              ) : null}
              {onClose ? (
                <Tooltip content={closeLabel}>
                  <IconButton size="xs" variant="ghost" aria-label={closeLabel} onClick={onClose}>
                    <Minus size={16} />
                  </IconButton>
                </Tooltip>
              ) : null}
            </HStack>
          </Header>
          <Box flex="1" minH={0} display="flex" flexDirection="column" gap="sm">
            {children}
          </Box>
        </Flex>
      </chakra.section>
    </Portal>
  );
});
