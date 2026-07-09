import { Checkbox as ChakraCheckbox } from "@chakra-ui/react";
import * as React from "react";

export interface CheckboxProps extends ChakraCheckbox.RootProps {
  icon?: React.ReactNode;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  rootRef?: React.RefObject<HTMLLabelElement | null>;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(props, ref) {
  const { icon, children, inputProps, rootRef, disabled = false, readOnly = false, ...rest } = props;
  const interactiveCursor = disabled ? "not-allowed" : readOnly ? "default" : "pointer";

  return (
    <ChakraCheckbox.Root ref={rootRef} disabled={disabled} readOnly={readOnly} cursor={interactiveCursor} {...rest}>
      <ChakraCheckbox.HiddenInput ref={ref} {...inputProps} />
      <ChakraCheckbox.Control
        bg="bg"
        borderColor="border"
        borderRadius="xs"
        color="fg.button.primary.default"
        cursor={interactiveCursor}
        transition="border-color 0.2s ease-in-out"
        boxShadow="none"
        _hover={{ borderColor: "border.accent-light" }}
        _active={{ borderColor: "border.accent-light" }}
        _focusVisible={{ borderColor: "border.accent-light", outline: "none", boxShadow: "none" }}
        _checked={{
          bg: "bg.button.primary.default",
          borderColor: "bg.button.primary.default",
          color: "fg.button.primary.default",
          _hover: { borderColor: "bg.button.primary.default" },
          _active: { borderColor: "bg.button.primary.default" },
        }}
        _indeterminate={{
          bg: "bg.button.primary.default",
          borderColor: "bg.button.primary.default",
          color: "fg.button.primary.default",
          _hover: { borderColor: "bg.button.primary.default" },
          _active: { borderColor: "bg.button.primary.default" },
        }}
      >
        {icon ? <ChakraCheckbox.Indicator>{icon}</ChakraCheckbox.Indicator> : <ChakraCheckbox.Indicator />}
      </ChakraCheckbox.Control>
      {children != null && <ChakraCheckbox.Label cursor={interactiveCursor}>{children}</ChakraCheckbox.Label>}
    </ChakraCheckbox.Root>
  );
});
