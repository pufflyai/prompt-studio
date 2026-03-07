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
      px: "0.5rem",
      h: "2.25rem",
      _hover: { bg: "bg.menu-item.hover" },
      _focus: { bg: "bg.menu-item.focus" },
      _active: { bg: "bg.menu-item.selected" },
    },

    content: {
      display: "flex",
      flexDirection: "column",
      gap: "2xs",
      borderRadius: "sm",
      py: "xs",
      bg: "bg",
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: "border.muted",
      boxShadow: "low",
      zIndex: "dropdown",
      textStyle: "label/M/regular",
    },
  },
});
