import { defineRecipe } from "@chakra-ui/react";

// Proposal-only styles; production adopts the accepted design in its shared theme.
export const reviewDocumentRecipe = defineRecipe({
  base: {
    flex: "1",
    minW: "0",
    minH: "0",
    "& .rich-text__mark, & .rich-text__markOverlap": {
      bg: "bg.warning",
      color: "fg",
      borderBottomColor: "border.warning",
      paddingBottom: "0",
      cursor: "pointer",
    },
    "& mark:focus-visible": { outline: "solid", outlineColor: "border.accent", outlineWidth: "2px" },
  },
});
