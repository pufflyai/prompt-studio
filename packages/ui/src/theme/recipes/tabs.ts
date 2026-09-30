import { defineSlotRecipe } from "@chakra-ui/react";
import { tabsAnatomy } from "@chakra-ui/react/anatomy";

export const tabsSlotRecipe = defineSlotRecipe({
  slots: tabsAnatomy.keys(),
  base: {
    root: {
      "--tabs-trigger-radius": "radii.xs",
    },
    list: {
      // The inline list would otherwise grow past its container to the tabs' full labels,
      // so crowded tabs could neither shrink nor scroll.
      maxW: "full",
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
      flexShrink: "0",
      overflow: "hidden",
      // Only tabs with a close button share a crowded row; the minimum keeps the
      // icon and close button whole. Other tabs keep their content width.
      "&:has([data-tab-close])": {
        flex: "1 1 0",
        minW: "tab-min",
        maxW: "fit-content",
      },
      // Keep bare-text labels on one line instead of wrapping.
      whiteSpace: "nowrap",
      "& [data-tab-label]": {
        minW: "0",
        maxW: "tab-label-max",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      },
      py: "0",
      borderRadius: "xs",
      borderWidth: "1px",
      borderColor: "border",
      color: "fg.muted",
      bg: "transparent",
      _selected: {
        color: "fg",
        bg: "bg.muted",
        borderColor: "border",
      },
      _hover: {
        bg: "bg.hover",
        borderColor: "border",
        color: "fg",
      },
      _disabled: {
        color: "fg.subtle",
        borderColor: "border",
        bg: "transparent",
        _hover: {
          color: "fg.subtle",
          borderColor: "border",
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
    // Full-width strip with a bottom hairline holding the triggers, per the
    // design's Tab Strip bars.
    tray: {
      true: {
        list: {
          width: "100%",
          paddingX: "lg",
          paddingBottom: "xs",
          // Restate the base's shorthand key so the hairline survives the merge.
          borderBottom: "1px solid",
          borderBottomColor: "border.subtle",
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
            borderColor: "border",
          },
          _hover: {
            bg: "bg.hover",
            borderColor: "border",
            color: "fg",
          },
          _disabled: {
            bg: "transparent",
            color: "fg.subtle",
            borderColor: "border",
            _hover: {
              bg: "transparent",
              color: "fg.subtle",
              borderColor: "border",
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
