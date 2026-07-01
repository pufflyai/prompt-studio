import { Slider as ChakraSlider } from "@chakra-ui/react";
import * as React from "react";

export interface SliderProps extends ChakraSlider.RootProps {}

export const Slider = React.forwardRef<HTMLDivElement, SliderProps>(function Slider(props, ref) {
  const { children, ...rest } = props;

  return (
    <ChakraSlider.Root ref={ref} variant="solid" {...rest}>
      <ChakraSlider.Control>
        <ChakraSlider.Track height="2px" borderRadius="0" bg="bg.muted">
          <ChakraSlider.Range bg="fg" />
        </ChakraSlider.Track>
        <ChakraSlider.Thumbs
          boxSize="0.625rem"
          bg="fg"
          borderWidth="1px"
          borderColor="bg"
          borderRadius="2xs"
          boxShadow="none"
          transition="width 0.12s ease, height 0.12s ease, border-color 0.2s ease-in-out"
          _hover={{ boxSize: "0.75rem", borderColor: "border.accent-light" }}
          _active={{ boxSize: "0.875rem", borderColor: "border.accent-light" }}
          _focusVisible={{ borderColor: "border.accent-light", outline: "none", boxShadow: "none" }}
        />
      </ChakraSlider.Control>
      {children}
    </ChakraSlider.Root>
  );
});
