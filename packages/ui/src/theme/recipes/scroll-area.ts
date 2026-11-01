import { defineSlotRecipe } from "@chakra-ui/react";

export const scrollAreaSlotRecipe = defineSlotRecipe({
  slots: ["root", "viewport", "content", "scrollbar", "thumb", "corner"],
  base: {
    viewport: {
      outline: "none",
    },
    scrollbar: {
      borderRadius: "2xs",
      bg: "transparent",
      "--thumb-bg": "colors.border",
      "&:is(:hover, :active)": {
        "--thumb-bg": "colors.fg.subtle",
      },
      // Extend the target into the viewport so the root cannot clip it away.
      _vertical: {
        "&::before": {
          insetInlineStart: "calc(var(--scrollbar-size) - var(--scrollbar-click-area))",
        },
      },
      _horizontal: {
        "&::before": {
          top: "calc(var(--scrollbar-size) - var(--scrollbar-click-area))",
        },
      },
    },
    content: {
      // Keep changing scrollbar geometry out of transcript styles. See ADR 0120.
      "--thumb-width": "initial",
      "--thumb-height": "initial",
      "--corner-width": "initial",
      "--corner-height": "initial",
      "--scroll-area-overflow-x-start": "initial",
      "--scroll-area-overflow-x-end": "initial",
      "--scroll-area-overflow-y-start": "initial",
      "--scroll-area-overflow-y-end": "initial",
    },
  },
  variants: {
    size: {
      xs: {
        root: {
          "--scrollbar-size": "sizes.scrollbar-thin",
          "--scrollbar-click-area": "spacing.xs",
        },
      },
    },
  },
});
