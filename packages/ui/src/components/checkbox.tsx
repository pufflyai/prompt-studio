import { Checkbox as ChakraCheckbox } from "@chakra-ui/react";
import * as React from "react";

export interface CheckboxProps extends ChakraCheckbox.RootProps {
  icon?: React.ReactNode;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  rootRef?: React.RefObject<HTMLLabelElement | null>;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(props, ref) {
  const { icon, children, inputProps, rootRef, disabled = false, ...rest } = props;
  const interactiveCursor = disabled ? "not-allowed" : "pointer";

  return (
    <ChakraCheckbox.Root ref={rootRef} disabled={disabled} cursor={interactiveCursor} {...rest}>
      <ChakraCheckbox.HiddenInput ref={ref} {...inputProps} />
      <ChakraCheckbox.Control borderRadius="xs" cursor={interactiveCursor}>
        {icon || <ChakraCheckbox.Indicator />}
      </ChakraCheckbox.Control>
      {children != null && <ChakraCheckbox.Label cursor={interactiveCursor}>{children}</ChakraCheckbox.Label>}
    </ChakraCheckbox.Root>
  );
});
