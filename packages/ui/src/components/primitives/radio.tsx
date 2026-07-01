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
        _hover={{ borderColor: "border" }}
        _checked={{
          bg: "bg.button.primary.default",
          borderColor: "bg.button.primary.default",
          color: "fg.button.primary.default",
        }}
      />
      {children ? <ChakraRadioGroup.ItemText>{children}</ChakraRadioGroup.ItemText> : null}
    </ChakraRadioGroup.Item>
  );
});

export const RadioGroup = ChakraRadioGroup.Root;
