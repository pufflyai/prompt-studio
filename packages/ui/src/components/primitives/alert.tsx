import { Box, ButtonPropsProvider, Alert as ChakraAlert, HStack, IconButton } from "@chakra-ui/react";
import { X } from "lucide-react";
import * as React from "react";
import { CopyButton } from "./copy-button";
import { ScrollArea } from "./scroll-area";

export interface AlertProps extends Omit<ChakraAlert.RootProps, "title"> {
  startElement?: React.ReactNode;
  // Recovery controls in the bottom-right footer. Buttons inherit compact, themed ghost defaults.
  endElement?: React.ReactNode;
  title?: React.ReactNode;
  icon?: React.ReactElement;
  // Shows a close button that dismisses the alert.
  onClose?: () => void;
  closeLabel?: string;
  /** Compact feedback beside an action or field. */
  compact?: boolean;
}

export const AlertMessage = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(props, ref) {
  const { title, children, icon, startElement, endElement, onClose, closeLabel = "Dismiss", compact, ...rest } = props;
  const contentRef = React.useRef<HTMLDivElement>(null);
  const isError = rest.status === "error";
  const message = typeof children === "string" ? children : undefined;
  const [dismissed, setDismissed] = React.useState<{ title: React.ReactNode; message?: string }>();
  if (dismissed && (dismissed.title !== title || dismissed.message !== message)) setDismissed(undefined);
  if (dismissed && dismissed.title === title && dismissed.message === message && isError && !onClose) return null;
  const close = onClose ?? (isError ? () => setDismissed({ title, message }) : undefined);
  const copyable = isError && !compact;
  return (
    <ChakraAlert.Root ref={ref} size={compact ? "sm" : undefined} role={isError ? "alert" : undefined} {...rest}>
      {startElement || <ChakraAlert.Indicator>{icon}</ChakraAlert.Indicator>}
      <ButtonPropsProvider value={{ variant: "ghost", size: "2xs" }}>
        <ChakraAlert.Content>
          <Box position="relative" minW="0" minH="0" flex="1">
            <ScrollArea contentRef={contentRef}>
              <Box paddingEnd={close ? "xl" : undefined}>
                <ChakraAlert.Title>{title}</ChakraAlert.Title>
                {children ? <ChakraAlert.Description>{children}</ChakraAlert.Description> : null}
              </Box>
            </ScrollArea>
            {close ? (
              <IconButton aria-label={closeLabel} position="absolute" top="0" insetInlineEnd="0" onClick={close}>
                <X />
              </IconButton>
            ) : null}
          </Box>
          {endElement || copyable ? (
            <HStack
              gap="2xs"
              pt="xs"
              justifyContent="flex-end"
              alignItems="flex-end"
              flexWrap="wrap"
              minW="0"
              flexShrink="0"
            >
              {copyable ? (
                <CopyButton size="2xs" label="Copy error message" text={() => contentRef.current?.innerText ?? ""} />
              ) : null}
              {endElement}
            </HStack>
          ) : null}
        </ChakraAlert.Content>
      </ButtonPropsProvider>
    </ChakraAlert.Root>
  );
});
