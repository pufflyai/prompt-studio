import { Slider as ChakraSlider } from "@chakra-ui/react";
import * as React from "react";

export interface SliderProps extends ChakraSlider.RootProps {}

export const Slider = React.forwardRef<HTMLDivElement, SliderProps>(function Slider(props, ref) {
  const { children, ...rest } = props;

  return (
    <ChakraSlider.Root ref={ref} variant="solid" {...rest}>
      <ChakraSlider.Control>
        <ChakraSlider.Track borderRadius="0">
          <ChakraSlider.Range />
        </ChakraSlider.Track>
        <ChakraSlider.Thumbs />
      </ChakraSlider.Control>
      {children}
    </ChakraSlider.Root>
  );
});
