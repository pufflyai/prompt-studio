import { useSlotRecipe } from "@chakra-ui/react";
import { landingSlotRecipe } from "../theme/recipes/landing";
import { landingDocSlotRecipe } from "../theme/recipes/landing-doc";
import { landingStorySlotRecipe } from "../theme/recipes/landing-story";
import { landingToolDemoSlotRecipe } from "../theme/recipes/landing-tool-demo";
import { useDemoComposition } from "./use-demo-composition";

export const useLandingStyles = (windowed = false) => {
  const recipe = useSlotRecipe({ recipe: landingSlotRecipe });
  return recipe({ windowed });
};

export const useStoryStyles = () =>
  useSlotRecipe({ recipe: landingStorySlotRecipe })({ compact: Boolean(useDemoComposition()) });
export const useToolDemoStyles = () =>
  useSlotRecipe({ recipe: landingToolDemoSlotRecipe })({ compact: Boolean(useDemoComposition()) });
export const useDocStyles = () => useSlotRecipe({ recipe: landingDocSlotRecipe })({});
