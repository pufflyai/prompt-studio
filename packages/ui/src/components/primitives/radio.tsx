import { RadioGroup as ChakraRadioGroup } from "@chakra-ui/react";
import * as React from "react";

export interface RadioProps extends ChakraRadioGroup.ItemProps {
  rootRef?: React.RefObject<HTMLDivElement | null>;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(function Radio(props, ref) {
  const { children, inputProps, rootRef, ...rest } = props;

  return (
    <ChakraRadioGroup.Item ref={rootRef} {...rest}>
      <ChakraRadioGroup.ItemHiddenInput ref={ref} {...inputProps} />
      <ChakraRadioGroup.ItemIndicator
        bg="bg"
        borderColor="border"
        color="fg.button.primary.default"
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
      />
      {children ? <ChakraRadioGroup.ItemText>{children}</ChakraRadioGroup.ItemText> : null}
    </ChakraRadioGroup.Item>
  );
});

export const RadioGroup = ChakraRadioGroup.Root;
