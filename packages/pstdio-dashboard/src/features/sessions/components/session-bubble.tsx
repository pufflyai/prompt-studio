import { Box, chakra, Flex, HStack, IconButton, Portal, Spacer } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { Minus, SquareArrowOutUpRight } from "lucide-react";
import { forwardRef, type ReactNode } from "react";

export interface SessionBubbleProps {
  isOpen?: boolean;
  title?: string;
  menu?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  onPopOut?: (() => void) | null;
  popOutLabel?: string;
  "aria-label"?: string;
  children?: ReactNode;
}

export const SessionBubble = forwardRef<HTMLDivElement, SessionBubbleProps>(function SessionBubble(props, ref) {
  const {
    isOpen = false,
    title,
    menu,
    onClose,
    closeLabel,
    onPopOut,
    popOutLabel,
    "aria-label": ariaLabel,
    children,
  } = props;

  if (!isOpen) return null;

  return (
    <Portal>
      <chakra.section
        ref={ref}
        role="dialog"
        data-testid="session-bubble"
        aria-label={ariaLabel ?? title}
        position="fixed"
        bottom="3"
        right="3"
        w="28rem"
        maxW="calc(100vw - 2rem)"
        h="38rem"
        maxH="calc(100vh - 2rem)"
        borderRadius="3xl"
        boxShadow="2xl"
        bg="bg"
        zIndex="dropdown" // Allow nested menus/modals to render above the panel
      >
        <Flex direction="column" h="full">
          <HStack alignItems="center" gap="sm" px="xs" pt="md" pb="xs">
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
          </HStack>
          <Box flex="1" minH={0} display="flex" flexDirection="column" gap="sm">
            {children}
          </Box>
        </Flex>
      </chakra.section>
    </Portal>
  );
});
