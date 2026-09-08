import { Box } from "@chakra-ui/react";
import { ShapeField } from "../shapes/shape-field";
import { useLandingStyles } from "./use-landing-styles";

interface StartHereViewProps {
  windowOffset?: { x: number; y: number };
}

export const StartHereView = (props: StartHereViewProps) => {
  const { windowOffset } = props;
  const styles = useLandingStyles();
  return (
    <Box css={styles.tools} minHeight={{ base: "96", lg: "full" }} role="region" aria-label="Your tools">
      <ShapeField spawn="container" worldOffset={windowOffset} />
    </Box>
  );
};
