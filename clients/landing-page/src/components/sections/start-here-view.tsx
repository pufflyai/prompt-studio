import { Box, Stack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useLandingStyles } from "../../hooks/use-landing-styles";
import { ShapeField } from "../shapes/shape-field";

interface StartHereViewProps {
  windowOffset?: { x: number; y: number };
  footer: ReactNode;
}

export const StartHereView = (props: StartHereViewProps) => {
  const { windowOffset, footer } = props;
  const styles = useLandingStyles();
  return (
    <Stack width="full" height="full" minWidth="0" gap="panel-gap">
      <Box css={styles.tools} flex="1" minHeight={{ base: "96", lg: "0" }} role="region" aria-label="Your tools">
        <ShapeField worldOffset={windowOffset} />
      </Box>
      {footer}
    </Stack>
  );
};
