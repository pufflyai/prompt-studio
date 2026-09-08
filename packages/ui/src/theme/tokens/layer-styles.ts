import { defineLayerStyles } from "@chakra-ui/react";

export const layerStyles = defineLayerStyles({
  panel: {
    value: {
      borderRadius: "sm",
      borderWidth: "1px",
      borderColor: "border.subtle",
      overflow: "hidden",
    },
  },
  floatingBar: {
    value: {
      paddingInline: "sm",
      paddingBlock: "2xs",
      borderRadius: "md",
      bg: "bg.elevated",
      border: "1px solid",
      borderColor: "border",
      boxShadow: "lg",
    },
  },
  // Cards clip their content so square children never paint over the rounded corners.
  panel: {
    value: {
      borderRadius: "sm",
      borderWidth: "1px",
      borderColor: "border.subtle",
      overflow: "hidden",
    },
  },
  modal: {
    value: {
      paddingInline: "xs",
      paddingBlock: "sm",
      borderRadius: "xs",
      bg: "bg",
      border: "1px solid",
      borderColor: "border",
    },
  },
});
