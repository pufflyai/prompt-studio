import { defineSlotRecipe } from "@chakra-ui/react";

const readingColumn = { width: "full", maxWidth: "3xl", mx: "auto", px: { base: "lg", md: "xl" } } as const;

// Documents come from markdown, so the typography targets plain tags instead of
// components.
export const landingDocSlotRecipe = defineSlotRecipe({
  slots: ["column", "prose", "navigation"],
  base: {
    column: { layerStyle: "panel", bg: "bg", width: "full", minWidth: 0, height: "full", overflow: "hidden" },
    prose: {
      ...readingColumn,
      display: "flex",
      flexDirection: "column",
      gap: "lg",
      pt: "3xl",
      pb: "2xl",
      color: "fg",
      "& h1": { textStyle: { base: "heading/M", md: "heading/L" } },
      "& h2": { textStyle: "heading/S", pt: "md" },
      "& h3": { textStyle: "label/L/medium" },
      "& p": { textStyle: "paragraph/M/regular", color: "fg.muted" },
      "& em": { textStyle: "label/S/italic", color: "fg.muted" },
      "& ul": {
        display: "flex",
        flexDirection: "column",
        gap: "sm",
        listStyleType: "disc",
        listStylePosition: "outside",
        ps: "lg",
      },
      "& li": { textStyle: "paragraph/M/regular", color: "fg.muted" },
      "& strong": { color: "fg", fontWeight: "medium" },
      "& a": { textDecoration: "underline", _hover: { color: "fg" } },
    },
    navigation: {
      ...readingColumn,
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: "sm",
      pb: "3xl",
    },
  },
});
