import { useSlotRecipe } from "@chakra-ui/react";
import { landingSlotRecipe } from "../theme/recipes/landing";
import { landingDocSlotRecipe } from "../theme/recipes/landing-doc";
import { landingPurposeSlotRecipe } from "../theme/recipes/landing-purpose";
import { landingStorySlotRecipe } from "../theme/recipes/landing-story";
import { landingToolDemoSlotRecipe } from "../theme/recipes/landing-tool-demo";
import { useDemoComposition } from "./use-demo-composition";
import { useFittedDemo } from "./use-fitted-demo";

export const useLandingStyles = (windowed = false) => {
  const recipe = useSlotRecipe({ recipe: landingSlotRecipe });
  return recipe({ windowed });
};

export const useStoryStyles = () =>
  useSlotRecipe({ recipe: landingStorySlotRecipe })({ compact: Boolean(useDemoComposition()), fill: useFittedDemo() });
export const useToolDemoStyles = () =>
  useSlotRecipe({ recipe: landingToolDemoSlotRecipe })({
    compact: Boolean(useDemoComposition()),
    fill: useFittedDemo(),
  });
export const useDocStyles = () => useSlotRecipe({ recipe: landingDocSlotRecipe })({});
export const usePurposeStyles = () => useSlotRecipe({ recipe: landingPurposeSlotRecipe })({});
