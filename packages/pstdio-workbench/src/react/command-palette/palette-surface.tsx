import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { workbenchCommandPaletteBackground } from "../theme/workbench-theme-background";

export const WorkbenchPaletteSurface = (props: { children: ReactNode }) => {
  const { children } = props;
  return (
    <Box
      display="contents"
      css={{
        "& [data-scope=dialog][data-part=backdrop], & [data-scope=dialog][data-part=positioner]": {
          position: "absolute",
          inset: "0",
        },
        "& [data-scope=dialog][data-part=positioner]": {
          alignItems: "center",
          justifyContent: "center",
          h: "full",
          minH: "0",
          padding: "md",
          w: "full",
        },
        "& [data-scope=dialog][data-part=content]": { background: workbenchCommandPaletteBackground },
      }}
    >
      {children}
    </Box>
  );
};
