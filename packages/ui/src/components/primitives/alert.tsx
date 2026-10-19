import { ButtonPropsProvider, Alert as ChakraAlert, HStack, IconButton } from "@chakra-ui/react";
import { X } from "lucide-react";
import * as React from "react";

export interface AlertProps extends Omit<ChakraAlert.RootProps, "title"> {
  startElement?: React.ReactNode;
  // Recovery controls in the bottom-right footer. Buttons inherit themed ghost defaults.
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
      <ChakraAlert.Content>
        <ChakraAlert.Title>{title}</ChakraAlert.Title>
        {children ? <ChakraAlert.Description>{children}</ChakraAlert.Description> : null}
        {endElement || onClose ? (
          <ButtonPropsProvider value={{ variant: "ghost", size: "xs" }}>
            <HStack gap="2xs" pt="xs" justifyContent="flex-end" alignItems="flex-end" flexWrap="wrap" minW="0">
              {endElement}
              {onClose ? (
                <IconButton aria-label={closeLabel} onClick={onClose}>
                  <X />
                </IconButton>
              ) : null}
            </HStack>
          </ButtonPropsProvider>
        ) : null}
      </ChakraAlert.Content>
    </ChakraAlert.Root>
  );
});
