import { defineLayerStyles } from "@chakra-ui/react";

export const layerStyles = defineLayerStyles({
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
