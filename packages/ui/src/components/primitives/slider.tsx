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
          bg="bg"
          borderWidth="1px"
          borderColor="border"
          borderRadius="2xs"
          transition="width 0.12s ease, height 0.12s ease, box-shadow 0.12s ease"
          _hover={{ boxSize: "0.75rem" }}
          _active={{ boxSize: "0.875rem" }}
        />
      </ChakraSlider.Control>
      {children}
    </ChakraSlider.Root>
  );
});
