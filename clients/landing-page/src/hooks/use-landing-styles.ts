import { useSlotRecipe } from "@chakra-ui/react";
import { landingSlotRecipe } from "../theme/recipes/landing";
import { landingDocSlotRecipe } from "../theme/recipes/landing-doc";
import { landingStorySlotRecipe } from "../theme/recipes/landing-story";

export const useLandingStyles = (windowed = false) => {
  const recipe = useSlotRecipe({ recipe: landingSlotRecipe });
  return recipe({ windowed });
};

export const useStoryStyles = () => useSlotRecipe({ recipe: landingStorySlotRecipe })({});
export const useDocStyles = () => useSlotRecipe({ recipe: landingDocSlotRecipe })({});
