import { createSystem, defineConfig } from "@chakra-ui/react";
import { globalCss } from "./global";
import { colors } from "./primitives/colors";
import { fontSizes, fonts, fontWeights } from "./primitives/fonts";
import { borderWidths, radii, sizes, spacing } from "./primitives/sizes";
import { alertSlotRecipe } from "./recipes/alert";
import { badgeRecipe } from "./recipes/badge";
import { buttonRecipe } from "./recipes/button";
import { chatQuestionBubbleRecipe } from "./recipes/chat-question-bubble";
import { checkboxSlotRecipe } from "./recipes/checkbox";
import { colorPickerSlotRecipe } from "./recipes/color-picker";
import { dialogSlotRecipe } from "./recipes/dialog";
import { dividerRecipe } from "./recipes/divider";
import { drawerSlotRecipe } from "./recipes/drawer";
import { editableSlotRecipe } from "./recipes/editable";
import { folderPickerSlotRecipe } from "./recipes/folder-picker";
import { fieldsetSlotRecipe } from "./recipes/form";
import { inputRecipe } from "./recipes/input";
import { kbdRecipe } from "./recipes/kbd";
import { listRowAccessoryRecipe } from "./recipes/list-row-accessory";
import { menuSlotRecipe } from "./recipes/menu";
import { numberInputSlotRecipe } from "./recipes/number-input";
import { paletteSlotRecipe } from "./recipes/palette";
import { popoverRecipe } from "./recipes/popover";
import { progressCircleSlotRecipe } from "./recipes/progress-circle";
import { resizableSplitLayoutSlotRecipe } from "./recipes/resizable-split-layout";
import { skeletonRecipe } from "./recipes/skeleton";
import { switchSlotRecipe } from "./recipes/switch";
import { tabsSlotRecipe } from "./recipes/tabs";
import { tagSlotRecipe } from "./recipes/tag";
import { textareaRecipe } from "./recipes/textarea";
import { timelineSlotRecipe } from "./recipes/timeline";
import { tooltipRecipe } from "./recipes/tooltip";
import { windowTabsRecipe, windowTitleBarRecipe } from "./recipes/window-title-bar";
import { shadowlessDefaultConfig } from "./shadowless-default-config";
import { borders } from "./tokens/borders";
import { semanticColors } from "./tokens/colors";
import { layerStyles } from "./tokens/layer-styles";
import { textStyles } from "./tokens/text";

const config = defineConfig({
  globalCss,
  utilities: {
    WebkitAppRegion: {
      values: ["drag", "no-drag"],
      transform: (value) => ({ WebkitAppRegion: value }),
    },
  },
  theme: {
    breakpoints: {
      "3xl": "2560px",
      "4xl": "3840px",
    },
    textStyles,
    layerStyles,
    recipes: {
      chatQuestionBubble: chatQuestionBubbleRecipe,
      badge: badgeRecipe,
      button: buttonRecipe,
      divider: dividerRecipe,
      input: inputRecipe,
      kbd: kbdRecipe,
      listRowAccessory: listRowAccessoryRecipe,
      skeleton: skeletonRecipe,
      textarea: textareaRecipe,
    },
    tokens: {
      colors,
      borderWidths,
      fonts,
      fontSizes,
      fontWeights,
      radii,
      sizes,
      spacing,
    },
    semanticTokens: {
      colors: semanticColors,
      borders,
    },
    slotRecipes: {
      tag: tagSlotRecipe,
      checkbox: checkboxSlotRecipe,
      windowTitleBar: windowTitleBarRecipe,
      windowTabs: windowTabsRecipe,
      resizableSplitLayout: resizableSplitLayoutSlotRecipe,
      alert: alertSlotRecipe,
      colorPicker: colorPickerSlotRecipe,
      drawer: drawerSlotRecipe,
      tooltip: tooltipRecipe,
      popover: popoverRecipe,
      menu: menuSlotRecipe,
      numberInput: numberInputSlotRecipe,
      palette: paletteSlotRecipe,
      editable: editableSlotRecipe,
      form: fieldsetSlotRecipe,
      dialog: dialogSlotRecipe,
      folderPicker: folderPickerSlotRecipe,
      progressCircle: progressCircleSlotRecipe,
      switch: switchSlotRecipe,
      tabs: tabsSlotRecipe,
      timeline: timelineSlotRecipe,
    },
  },
});

export default createSystem(shadowlessDefaultConfig, config);
