import { Box, useRecipe } from "@chakra-ui/react";
import { createContext, type ReactNode, useContext } from "react";

const TreeListRowVisibility = createContext(true);
/** Collapse keeps the DOM for its animation while optional row observations stop. */
export const useTreeListRowVisibility = () => useContext(TreeListRowVisibility);

export const TreeListReveal = (props: { open: boolean; children: ReactNode }) => {
  const { open, children } = props;
  const ancestorVisible = useTreeListRowVisibility();
  const recipe = useRecipe({ key: "treeReveal" });
  return (
    <Box css={recipe()} data-tree-reveal="" data-open={open} inert={!open} aria-hidden={!open}>
      <Box>
        <TreeListRowVisibility value={ancestorVisible && open}>{children}</TreeListRowVisibility>
      </Box>
    </Box>
  );
};
