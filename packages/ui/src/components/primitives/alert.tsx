import { ButtonPropsProvider, Alert as ChakraAlert, HStack, IconButton } from "@chakra-ui/react";
import { X } from "lucide-react";
import * as React from "react";

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
  return (
    <ChakraAlert.Root ref={ref} {...rest}>
      {startElement || <ChakraAlert.Indicator>{icon}</ChakraAlert.Indicator>}
      <ButtonPropsProvider value={{ variant: "ghost", size: "2xs" }}>
        <ChakraAlert.Content>
          <HStack gap="2xs" alignItems="flex-start" minW="0">
            <ChakraAlert.Title flex="1" minW="0">
              {title}
            </ChakraAlert.Title>
            {onClose ? (
              <IconButton aria-label={closeLabel} flexShrink="0" onClick={onClose}>
                <X />
              </IconButton>
            ) : null}
          </HStack>
          {children ? <ChakraAlert.Description>{children}</ChakraAlert.Description> : null}
          {endElement ? (
            <HStack gap="2xs" pt="xs" justifyContent="flex-end" alignItems="flex-end" flexWrap="wrap" minW="0">
              {endElement}
            </HStack>
          ) : null}
        </ChakraAlert.Content>
      </ButtonPropsProvider>
    </ChakraAlert.Root>
  );
});
