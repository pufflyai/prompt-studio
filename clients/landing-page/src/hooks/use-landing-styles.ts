import { useSlotRecipe } from "@chakra-ui/react";

export const useLandingStyles = (windowed = false) => {
  const recipe = useSlotRecipe({ key: "landing" });
  return recipe({ windowed });
};

export const useStoryStyles = () => useSlotRecipe({ key: "landingStory" })({});
export const useToolDemoStyles = () => useSlotRecipe({ key: "landingToolDemo" })({});
