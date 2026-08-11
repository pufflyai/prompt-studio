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
      <ChakraSwitch.Control cursor={interactiveCursor}>
        <ChakraSwitch.Thumb>
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
