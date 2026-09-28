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
  // Cards clip their content so square children never paint over the rounded corners.
  panel: {
    value: {
      borderRadius: "sm",
      borderWidth: "1px",
      borderColor: "border.subtle",
      overflow: "hidden",
    },
  },
  // A dashed outline marks an area that takes dropped files. While something is dragged over it,
  // the outline takes the accent color and the area fills in.
  dropZone: {
    idle: {
      value: {
        borderRadius: "sm",
        borderWidth: "1px",
        borderStyle: "dashed",
        borderColor: "border",
      },
    },
    active: {
      value: {
        borderRadius: "sm",
        borderWidth: "1px",
        borderStyle: "dashed",
        borderColor: "border.accent",
        bg: "bg.subtle",
      },
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
