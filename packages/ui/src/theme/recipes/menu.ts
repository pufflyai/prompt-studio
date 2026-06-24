import { defineSlotRecipe } from "@chakra-ui/react";
import { menuAnatomy } from "@chakra-ui/react/anatomy";

export const menuSlotRecipe = defineSlotRecipe({
  slots: menuAnatomy.keys(),
  base: {
    itemGroupLabel: {
      ml: "{2xs}",
      textStyle: "label/S/regular",
      fontWeight: "normal",
      color: "fg.muted",
    },

    item: {
      bg: "bg.menu-item.default",
      color: "fg.menu-item.default",
      textStyle: "label/M/regular",
      cursor: "pointer",
      px: "0",
      h: "auto",
      _hover: {
        bg: "bg.menu-item.hover",
      },
      _highlighted: {
        bg: "bg.menu-item.hover",
      },
      _focusVisible: {
        bg: "bg.menu-item.focus",
      },
      _disabled: {
        cursor: "not-allowed",
      },
    },

    separator: {
      my: "2xs",
      borderColor: "border.muted",
    },

    content: {
      display: "flex",
      flexDirection: "column",
      gap: "0",
      borderRadius: "2xs",
      p: "0",
      px: "0",
      py: "0",
      bg: "bg",
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: "border.muted",
      zIndex: "dropdown",
      textStyle: "label/M/regular",
    },
  },
});
