import { Alert as ChakraAlert, HStack, IconButton } from "@chakra-ui/react";
import { X } from "lucide-react";
import * as React from "react";

export interface AlertProps extends Omit<ChakraAlert.RootProps, "title"> {
  startElement?: React.ReactNode;
  // An action that recovers from the alert, such as Retry for a temporary failure.
  endElement?: React.ReactNode;
  title?: React.ReactNode;
  icon?: React.ReactElement;
  // Shows a close button that dismisses the alert.
  onClose?: () => void;
}

export const AlertMessage = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(props, ref) {
  const { title, children, icon, startElement, endElement, onClose, ...rest } = props;
  return (
    <ChakraAlert.Root ref={ref} px="xs" py="2xs" gap="2xs" minH="auto" {...rest}>
      {startElement || <ChakraAlert.Indicator>{icon}</ChakraAlert.Indicator>}
      {children ? (
        <ChakraAlert.Content>
          <ChakraAlert.Title>{title}</ChakraAlert.Title>
          <ChakraAlert.Description>{children}</ChakraAlert.Description>
        </ChakraAlert.Content>
      ) : (
        <ChakraAlert.Title flex="1">{title}</ChakraAlert.Title>
      )}
      {endElement || onClose ? (
        <HStack gap="2xs" alignSelf="center">
          {endElement}
          {onClose ? (
            <IconButton aria-label="Dismiss" size="2xs" variant="ghost" onClick={onClose}>
              <X />
            </IconButton>
          ) : null}
        </HStack>
      ) : null}
    </ChakraAlert.Root>
  );
});
