import { Switch as ChakraSwitch } from "@chakra-ui/react";
import * as React from "react";

export interface SwitchProps extends ChakraSwitch.RootProps {
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  rootRef?: React.RefObject<HTMLLabelElement | null>;
  trackLabel?: { on: React.ReactNode; off: React.ReactNode };
  thumbLabel?: { on: React.ReactNode; off: React.ReactNode };
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(function Switch(props, ref) {
  const { inputProps, children, rootRef, trackLabel, thumbLabel, disabled = false, ...rest } = props;
  const interactiveCursor = disabled ? "not-allowed" : "pointer";

  return (
    <ChakraSwitch.Root ref={rootRef} disabled={disabled} cursor={interactiveCursor} {...rest}>
      <ChakraSwitch.HiddenInput ref={ref} {...inputProps} />
      <ChakraSwitch.Control
        bg="bg.muted"
        borderWidth="1px"
        borderColor="border"
        borderRadius="md"
        color="fg"
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
      >
        <ChakraSwitch.Thumb bg="bg" borderColor="border" borderRadius="full">
          {thumbLabel && (
            <ChakraSwitch.ThumbIndicator fallback={thumbLabel?.off}>{thumbLabel?.on}</ChakraSwitch.ThumbIndicator>
          )}
        </ChakraSwitch.Thumb>
        {trackLabel && <ChakraSwitch.Indicator fallback={trackLabel.off}>{trackLabel.on}</ChakraSwitch.Indicator>}
      </ChakraSwitch.Control>
      {children != null && <ChakraSwitch.Label cursor={interactiveCursor}>{children}</ChakraSwitch.Label>}
    </ChakraSwitch.Root>
  );
});
