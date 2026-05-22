import { defineSlotRecipe } from "@chakra-ui/react";
import { tabsAnatomy } from "@chakra-ui/react/anatomy";

export const tabsSlotRecipe = defineSlotRecipe({
  slots: tabsAnatomy.keys(),
  base: {
    trigger: {
      borderRadius: "0",
    },
  },
  variants: {
    variant: {
      subtle: {
        trigger: {
          color: "fg.muted",
          bg: "transparent",
          _hover: {
            bg: "bg.hover",
            color: "fg",
          },
          _selected: {
            bg: "bg.muted",
            color: "fg",
          },
        },
      },
      // Folder-style tabs: only the selected tab is outlined and it merges with
      // the panel content below via a transparent bottom border. Adapts Chakra's
      // built-in `outline` variant for use inside a workbench header — the
      // header paints its own full-width bottom line, so the variant's own
      // underline and the negative margins that overlap it are suppressed.
      outline: {
        list: {
          border: "0",
          _horizontal: {
            _before: {
              borderBottomWidth: "0",
            },
          },
        },
        trigger: {
          color: "fg.muted",
          bg: "transparent",
          borderWidth: "1px",
          borderColor: "transparent",
          _selected: {
            color: "fg",
            borderColor: "border.muted",
            borderBottomColor: "transparent",
          },
          _horizontal: {
            borderTopRadius: "0",
            marginBottom: "0",
            marginEnd: "0",
            _selected: {
              borderColor: "border.muted",
              borderBottomColor: "transparent",
            },
          },
        },
      },
    },
  },
});
