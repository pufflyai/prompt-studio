import { createSystem, defineConfig } from "@chakra-ui/react";
import { globalCss } from "./global";
import { colors } from "./primitives/colors";
import { fontSizes, fonts, fontWeights } from "./primitives/fonts";
import { radii, spacing } from "./primitives/sizes";
import { alertSlotRecipe } from "./recipes/alert";
import { buttonRecipe } from "./recipes/button";
import { dialogSlotRecipe } from "./recipes/dialog";
import { dividerRecipe } from "./recipes/divider";
import { drawerSlotRecipe } from "./recipes/drawer";
import { editableSlotRecipe } from "./recipes/editable";
import { fieldsetSlotRecipe } from "./recipes/form";
import { inputRecipe } from "./recipes/input";
import { kbdRecipe } from "./recipes/kbd";
import { menuSlotRecipe } from "./recipes/menu";
import { popoverRecipe } from "./recipes/popover";
import { progressCircleSlotRecipe } from "./recipes/progress-circle";
import { skeletonRecipe } from "./recipes/skeleton";
import { tabsSlotRecipe } from "./recipes/tabs";
import { textareaRecipe } from "./recipes/textarea";
import { tooltipRecipe } from "./recipes/tooltip";
import { shadowlessDefaultConfig } from "./shadowless-default-config";
import { borders } from "./tokens/borders";
import { semanticColors } from "./tokens/colors";
import { layerStyles } from "./tokens/layer-styles";
import { textStyles } from "./tokens/text";

const config = defineConfig({
  globalCss,
  theme: {
    breakpoints: {
      "3xl": "2560px",
      "4xl": "3840px",
    },
    textStyles,
    layerStyles,
    recipes: {
      button: buttonRecipe,
      divider: dividerRecipe,
      input: inputRecipe,
      kbd: kbdRecipe,
      skeleton: skeletonRecipe,
      textarea: textareaRecipe,
    },
    tokens: {
      colors,
      fonts,
      fontSizes,
      fontWeights,
      radii,
      spacing,
    },
    semanticTokens: {
      colors: semanticColors,
      borders,
    },
    slotRecipes: {
      alert: alertSlotRecipe,
      drawer: drawerSlotRecipe,
      tooltip: tooltipRecipe,
      popover: popoverRecipe,
      menu: menuSlotRecipe,
      editable: editableSlotRecipe,
      form: fieldsetSlotRecipe,
      dialog: dialogSlotRecipe,
      progressCircle: progressCircleSlotRecipe,
      tabs: tabsSlotRecipe,
    },
  },
});

export default createSystem(shadowlessDefaultConfig, config);
