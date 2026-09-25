import { Box, ChakraProvider } from "@chakra-ui/react";
// Remotion's bundler drops the font imports that ship inside @pstdio/ui/theme,
// so the render declares the faces it draws with.
import "@fontsource/inter/400.css";
import "@fontsource/onest/400.css";
import "@fontsource/onest/500.css";
import "@pstdio/ui/style.css";
import { type ReactNode, useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";
import { landingTheme } from "../src/theme/theme";

// Renders always use the light theme so the generated assets stay deterministic.
const FONTS = ["500 48px Onest", "400 20px Inter", "400 12px Onest"];

interface BrandCanvasProps {
  children: ReactNode;
}

export const BrandCanvas = (props: BrandCanvasProps) => {
  const { children } = props;
  const [handle] = useState(() => delayRender("Loading brand fonts"));

  useEffect(() => {
    Promise.all(FONTS.map((font) => document.fonts.load(font))).then(() => continueRender(handle));
  }, [handle]);

  return (
    <ChakraProvider value={landingTheme}>
      <Box className="light" position="relative" width="100%" height="100%" bg="bg.subtle" color="fg">
        {children}
      </Box>
    </ChakraProvider>
  );
};
