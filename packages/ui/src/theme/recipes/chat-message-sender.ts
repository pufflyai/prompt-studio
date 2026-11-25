import { defineRecipe } from "@chakra-ui/react";

export const chatMessageSenderRecipe = defineRecipe({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    boxSize: "6",
    borderRadius: "full",
    // The circle is smaller than its focus and pointer target.
    "& [data-scope=avatar][data-part=root]": { "--avatar-size": "{sizes.4}" },
  },
  variants: {
    interactive: {
      true: {
        cursor: "pointer",
        _hover: { bg: "bg.hover" },
        focusVisibleRing: "outside",
      },
    },
  },
});
