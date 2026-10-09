import { defineSlotRecipe } from "@chakra-ui/react";

export const paletteSlotRecipe = defineSlotRecipe({
  slots: ["positioner", "content", "results"],
  base: {
    positioner: { alignItems: "center", justifyContent: "center", p: "md" },
    content: {
      "--palette-results-height": "sizes.palette-results-height",
      maxW: "palette-width",
      w: "full",
      p: 0,
      m: 0,
      overflow: "hidden",
    },
  },
  variants: {
    fullScreen: {
      true: {
        positioner: { p: 0 },
        content: {
          "--palette-results-height": "none",
          maxW: "full",
          h: "100dvh",
          borderWidth: 0,
          borderRadius: "none",
          "& > .chakra-dialog__header, & > .chakra-dialog__footer": { flexShrink: 0 },
          "& > .chakra-dialog__body": { display: "flex", flexDirection: "column", minH: 0 },
        },
        results: { flex: 1, minH: 0 },
      },
    },
  },
});
