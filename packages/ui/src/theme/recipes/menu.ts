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
      justifyContent: "flex-start",
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
      "&[data-type]": { ps: "sm" },
      _disabled: {
        cursor: "not-allowed",
        color: "fg.muted",
      },
    },

    itemIndicator: {
      boxSize: "3.5",
      "& svg": { boxSize: "full" },
      position: "static",
      insetStart: "auto",
      top: "auto",
      transform: "none",
      color: "fg",
      marginInlineStart: "auto",
      order: 1,
      flexShrink: 0,
    },

    itemText: { flex: "1", minWidth: "0", textAlign: "left" },
    itemCommand: { marginInlineStart: "auto" },

    separator: {
      my: "0",
      mx: "0",
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
      borderColor: "border.subtle",
      textStyle: "label/M/regular",
    },
  },
  variants: {
    size: {
      sm: { item: { px: "sm" } },
      md: { item: { px: "sm" } },
    },
    variant: {
      panel: {
        content: {
          width: "64",
          minWidth: "64",
          maxWidth: "64",
          // An iframe needs a definite viewport; it cannot size a menu from its guest content.
          "&:has(iframe)": {
            h: "64",
            maxH: "var(--available-height)",
          },
        },
      },
    },
  },
});
