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
}

export const AlertMessage = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(props, ref) {
  const { title, children, icon, startElement, endElement, onClose, closeLabel = "Dismiss", ...rest } = props;
  const contentRef = React.useRef<HTMLDivElement>(null);
  const copyable = rest.status === "error";
  return (
    <ChakraAlert.Root ref={ref} {...rest}>
      {startElement || <ChakraAlert.Indicator>{icon}</ChakraAlert.Indicator>}
      <ButtonPropsProvider value={{ variant: "ghost", size: "2xs" }}>
        <ChakraAlert.Content>
          <Box position="relative" minW="0" minH="0" flex="1">
            <ScrollArea contentRef={contentRef}>
              <Box paddingEnd={onClose ? "xl" : undefined}>
                <ChakraAlert.Title>{title}</ChakraAlert.Title>
                {children ? <ChakraAlert.Description>{children}</ChakraAlert.Description> : null}
              </Box>
            </ScrollArea>
            {onClose ? (
              <IconButton aria-label={closeLabel} position="absolute" top="0" right="xs" onClick={onClose}>
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
