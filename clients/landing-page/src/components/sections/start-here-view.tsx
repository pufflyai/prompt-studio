import { Box } from "@chakra-ui/react";
import { useLandingStyles } from "../../hooks/use-landing-styles";
import { ShapeField } from "../shapes/shape-field";

interface StartHereViewProps {
  windowOffset?: { x: number; y: number };
}

export const StartHereView = (props: StartHereViewProps) => {
  const { windowOffset } = props;
  const styles = useLandingStyles();
  return (
    <Box css={styles.tools} minHeight={{ base: "96", lg: "full" }} role="region" aria-label="Your tools">
      <ShapeField worldOffset={windowOffset} />
    </Box>
  );
};
