import { Box, type BoxProps } from "@chakra-ui/react";

interface DropIndicatorProps extends BoxProps {
  orientation?: "horizontal" | "vertical";
}
export const DropIndicator = (props: DropIndicatorProps) => {
  const { orientation = "horizontal", ...rest } = props;
  return (
    <Box
      aria-hidden
      layerStyle="dropIndicator"
      {...(orientation === "vertical" ? { insetY: "0", w: "drop-indicator" } : { insetX: "0", h: "drop-indicator" })}
      {...rest}
    />
  );
};
