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
      width: "full",
      minWidth: "0",
      maxWidth: "full",
      minH: "1.75rem",
      h: "auto",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "xs",
      px: "sm",
      py: "2xs",
      borderRadius: "0",
      bg: "transparent",
      color: "fg.menu-item.default",
      textStyle: "label/S/regular",
      cursor: "pointer",
      overflow: "hidden",
      textAlign: "left",
      textDecoration: "none",
      _hover: {
        bg: "bg.menu-item.hover",
      },
      _highlighted: {
        bg: "bg.menu-item.hover",
      },
      _focusVisible: {
        bg: "bg.menu-item.focus",
      },
      _checked: {
        bg: "bg.menu-item.selected",
        color: "fg",
      },
      _selected: {
        bg: "bg.menu-item.selected",
        color: "fg",
      },
      "&[aria-checked=true]": {
        bg: "bg.menu-item.selected",
        color: "fg",
      },
      _disabled: {
        cursor: "not-allowed",
        color: "fg.muted",
      },
    },

    itemIndicator: {
      color: "fg",
    },

    separator: {
      my: "0",
      borderColor: "border.subtle",
    },

    content: {
      display: "flex",
      flexDirection: "column",
      width: "17.5rem",
      minWidth: "17.5rem",
      maxWidth: "17.5rem",
      gap: "0",
      borderRadius: "xs",
      p: "0",
      px: "0",
      py: "0",
      bg: "bg",
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: "border",
      textStyle: "label/M/regular",
    },
  },
});
