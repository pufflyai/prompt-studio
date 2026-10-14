import {
  Box,
  chakra,
  Flex,
  HStack,
  type HTMLChakraProps,
  IconButton,
  Portal,
  Spacer,
  useRecipe,
} from "@chakra-ui/react";
import { Minus, SquareArrowOutUpRight } from "lucide-react";
import { forwardRef, type ReactNode } from "react";
import { Header } from "@/components/layout/header";
import { PANEL_HEADER_CONTROL_SIZE } from "@/components/layout/panel-header.constants";
import { Tooltip } from "@/components/primitives/tooltip";
import type { BubbleAnchor } from "@/theme/recipes/bubble-anchor";

interface BubblePanelContainerProps extends HTMLChakraProps<"section"> {
  [attribute: `data-${string}`]: string | number | boolean | undefined;
}

export interface BubblePanelProps {
  isOpen?: boolean;
  title?: string;
  showHeader?: boolean;
  menu?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  onPopOut?: (() => void) | null;
  popOutLabel?: string;
  width?: string;
  height?: string;
  containerProps?: BubblePanelContainerProps;
  testId?: string;
  "aria-label"?: string;
  children?: ReactNode;
  overlay?: ReactNode;
  anchor?: BubbleAnchor;
  portalled?: boolean;
}

export const BubblePanel = forwardRef<HTMLDivElement, BubblePanelProps>(function BubblePanel(props, ref) {
  const {
    isOpen = false,
    title,
    showHeader = true,
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
    overlay,
    anchor = "bottom-right",
    portalled = true,
  } = props;

  const motion = useRecipe({ key: "bubblePanel" });

  return (
    <Portal disabled={!portalled}>
      <chakra.section
        ref={ref}
        role="dialog"
        data-testid={testId}
        aria-label={ariaLabel ?? title}
        position="fixed"
        w={width}
        maxW="calc(100% - {spacing.6} - {spacing.6} - {spacing.12} - {spacing.3})"
        h={height}
        maxH="calc(100% - {spacing.6} - {spacing.6} - {spacing.12} - {spacing.3})"
        borderRadius="xs"
        borderWidth="1px"
        borderColor="border.subtle"
        bg="bg"
        overflow="hidden"
        zIndex="dropdown"
        {...containerProps}
        css={motion({ anchor })}
        data-open={isOpen}
        inert={!isOpen}
        aria-hidden={!isOpen}
      >
        <Flex direction="column" h="full">
          {showHeader && (
            <Header variant="main" gap="sm" flexShrink={0}>
              <HStack gap="1" minW="0">
                {menu}
              </HStack>
              <Spacer />
              <HStack gap="1">
                {onPopOut ? (
                  <Tooltip content={popOutLabel}>
                    <IconButton
                      size={PANEL_HEADER_CONTROL_SIZE}
                      variant="ghost"
                      aria-label={popOutLabel}
                      onClick={onPopOut}
                    >
                      <SquareArrowOutUpRight size={16} />
                    </IconButton>
                  </Tooltip>
                ) : null}
                {onClose ? (
                  <Tooltip content={closeLabel}>
                    <IconButton
                      size={PANEL_HEADER_CONTROL_SIZE}
                      variant="ghost"
                      aria-label={closeLabel}
                      onClick={onClose}
                    >
                      <Minus size={16} />
                    </IconButton>
                  </Tooltip>
                ) : null}
              </HStack>
            </Header>
          )}
          <Box flex="1" minH={0} display="flex" flexDirection="column" gap="sm">
            {children}
          </Box>
        </Flex>
        {overlay}
      </chakra.section>
    </Portal>
  );
});
