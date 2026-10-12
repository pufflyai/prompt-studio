import { Box, useRecipe } from "@chakra-ui/react";
import type { ReactNode } from "react";

export const TreeListReveal = (props: { open: boolean; children: ReactNode }) => {
  const { open, children } = props;
  const recipe = useRecipe({ key: "treeReveal" });
  return (
    <Box css={recipe()} data-tree-reveal="" data-open={open} inert={!open} aria-hidden={!open}>
      <Box>{children}</Box>
    </Box>
  );
};
