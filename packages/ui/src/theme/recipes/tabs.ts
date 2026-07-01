import { defineSlotRecipe } from "@chakra-ui/react";
import { tabsAnatomy } from "@chakra-ui/react/anatomy";

export const tabsSlotRecipe = defineSlotRecipe({
  slots: tabsAnatomy.keys(),
  base: {
    root: {
      "--tabs-trigger-radius": "radii.xs",
    },
    list: {
      gap: "2xs",
      alignItems: "center",
      justifyContent: "flex-start",
      borderBottom: "0",
      _horizontal: {
        _before: {
          borderBottomWidth: "0",
        },
      },
    },
    trigger: {
      minW: "0",
      flexShrink: "0",
      py: "0",
      borderRadius: "xs",
      borderWidth: "1px",
      borderColor: "border.subtle",
      color: "fg.muted",
      bg: "transparent",
      _selected: {
        color: "fg",
        bg: "bg.muted",
        borderColor: "border.subtle",
      },
      _hover: {
        bg: "bg.hover",
        borderColor: "border.subtle",
        color: "fg",
      },
      _disabled: {
        color: "fg.subtle",
        borderColor: "border.subtle",
        bg: "transparent",
        _hover: {
          color: "fg.subtle",
          borderColor: "border.subtle",
          bg: "transparent",
        },
      },
    },
  },
  variants: {
    size: {
      xs: {
        trigger: {
          h: "1.25rem",
          px: "xs",
          gap: "2xs",
          textStyle: "label/XS/medium",
          _icon: {
            width: "0.75rem",
            height: "0.75rem",
          },
        },
      },
      sm: {
        trigger: {
          h: "1.5rem",
          px: "xs",
          gap: "2xs",
          textStyle: "label/XS/medium",
          _icon: {
            width: "0.875rem",
            height: "0.875rem",
          },
        },
      },
      md: {
        trigger: {
          h: "1.75rem",
          px: "0.5rem",
          gap: "xs",
          textStyle: "label/S/medium",
          _icon: {
            width: "0.875rem",
            height: "0.875rem",
          },
        },
      },
    },
    variant: {
      subtle: {
        trigger: {
          borderRadius: "var(--tabs-trigger-radius)",
          color: "fg.muted",
          bg: "transparent",
          _selected: {
            color: "fg",
            bg: "bg.muted",
            borderColor: "border.subtle",
          },
          _hover: {
            bg: "bg.hover",
            borderColor: "border.subtle",
            color: "fg",
          },
          _disabled: {
            bg: "transparent",
            color: "fg.subtle",
            borderColor: "border.subtle",
            _hover: {
              bg: "transparent",
              color: "fg.subtle",
              borderColor: "border.subtle",
            },
          },
        },
      },
    },
  },
  defaultVariants: {
    size: "xs",
    variant: "subtle",
  },
});
