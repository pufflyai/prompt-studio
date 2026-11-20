import { defineSlotRecipe } from "@chakra-ui/react";

export const landingChaptersSlotRecipe = defineSlotRecipe({
  slots: ["page", "intro", "chapter", "copy", "scene", "cta"],
  base: {
    page: {
      display: "flex",
      flexDirection: "column",
      width: "full",
      maxWidth: "8xl",
      mx: "auto",
      px: { base: "lg", md: "xl" },
      py: "3xl",
      containerType: "inline-size",
    },
    intro: { display: "flex", flexDirection: "column", gap: "sm", maxWidth: "3xl", pb: "2xl" },
    chapter: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: "xl",
      alignItems: "center",
      py: "2xl",
      // Chapters alternate scene and text on wide screens.
      "@container (min-width: 52rem)": {
        gridTemplateColumns: "minmax(15rem, 18rem) minmax(0, 1fr)",
        "&:nth-of-type(odd)": { gridTemplateColumns: "minmax(0, 1fr) minmax(15rem, 18rem)" },
        "&:nth-of-type(odd) > [data-part=copy]": { order: 2 },
      },
    },
    copy: { display: "flex", flexDirection: "column", gap: "sm" },
    scene: { minWidth: 0 },
    cta: {
      display: "flex",
      flexDirection: "column",
      gap: "md",
      pt: "2xl",
    },
  },
});
