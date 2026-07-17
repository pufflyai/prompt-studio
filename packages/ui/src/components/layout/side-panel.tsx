import type { HTMLChakraProps, RecipeVariantProps } from "@chakra-ui/react";
import { createSlotRecipeContext, Portal } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { sidePanelSlotRecipe } from "../../theme/recipes/side-panel";

type SidePanelVariantProps = RecipeVariantProps<typeof sidePanelSlotRecipe>;

const sidePanelRecipe = createSlotRecipeContext({ recipe: sidePanelSlotRecipe });
const SidePanelRoot = sidePanelRecipe.withProvider<HTMLElement, HTMLChakraProps<"section"> & SidePanelVariantProps>(
  "section",
  "root",
);
const SidePanelHeader = sidePanelRecipe.withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "header");
const SidePanelContent = sidePanelRecipe.withContext<HTMLDivElement, HTMLChakraProps<"div">>("div", "content");

export interface SidePanelProps extends Omit<HTMLChakraProps<"section">, "children">, SidePanelVariantProps {
  children?: ReactNode;
  header?: ReactNode;
}

export const SidePanel = (props: SidePanelProps) => {
  const { children, header, presentation = "docked", ...rootProps } = props;
  const panel = (
    <SidePanelRoot presentation={presentation} role={presentation === "floating" ? "dialog" : undefined} {...rootProps}>
      {header ? <SidePanelHeader>{header}</SidePanelHeader> : null}
      <SidePanelContent>{children}</SidePanelContent>
    </SidePanelRoot>
  );

  return presentation === "floating" ? <Portal>{panel}</Portal> : panel;
};
