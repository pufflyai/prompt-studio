import { useSlotRecipe } from "@chakra-ui/react";
import { landingSlotRecipe } from "../theme/recipes/landing";
import { landingStorySlotRecipe } from "../theme/recipes/landing-story";
import { landingToolDemoSlotRecipe } from "../theme/recipes/landing-tool-demo";

export const useLandingStyles = (windowed = false) => {
  const recipe = useSlotRecipe({ recipe: landingSlotRecipe });
  return recipe({ windowed });
};

export const useStoryStyles = (spacing: "normal" | "spacious" = "normal") =>
  useSlotRecipe({ recipe: landingStorySlotRecipe })({ spacing });
export const useToolDemoStyles = () => useSlotRecipe({ recipe: landingToolDemoSlotRecipe })({});
