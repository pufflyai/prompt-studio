import { defineRecipe } from "@chakra-ui/react";

export const chatPanelRecipe = defineRecipe({
  className: "ps-chat-panel",
  base: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    width: "full",
    height: "full",
    overflow: "hidden",
    bg: "bg",
  },
});
