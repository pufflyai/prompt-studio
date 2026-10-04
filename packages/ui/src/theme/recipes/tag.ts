import { defineSlotRecipe } from "@chakra-ui/react";
import { tagAnatomy } from "@chakra-ui/react/anatomy";
import { ticketTagStyle } from "./badge";

export const tagSlotRecipe = defineSlotRecipe({
  slots: tagAnatomy.keys(),
  base: {
    root: {
      display: "inline-flex",
      alignItems: "center",
      borderRadius: "pill",
      gap: "2xs",
      minW: "0",
      maxW: "64",
      flexShrink: "1",
    },
    label: {
      minW: "0",
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      cursor: "pointer",
      _focusVisible: { outline: "2px solid", outlineColor: "border", outlineOffset: "2px" },
    },
    startElement: {
      "& [data-status-dot]": { display: "block", boxSize: "status-dot", borderRadius: "full", bg: "fg.muted" },
      "& [data-tone=success]": { bg: "fg.success" },
      "& [data-tone=info]": { bg: "fg.info" },
      "& [data-tone=warning]": { bg: "fg.warning" },
      "& [data-tone=error]": { bg: "fg.error" },
    },
    closeTrigger: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      boxSize: "4",
      flexShrink: "0",
      borderRadius: "full",
      cursor: "pointer",
      _hover: { bg: "bg.hover" },
      _disabled: { cursor: "not-allowed", opacity: "0.5" },
      _focusVisible: { outline: "2px solid", outlineColor: "border" },
      "& svg": { boxSize: "3" },
    },
  },
  variants: {
    variant: { ticket: { root: ticketTagStyle } },
    size: { composer: { root: { height: "7", minH: "7", px: "xs", py: "0", textStyle: "label/S/medium" } } },
  },
  defaultVariants: { variant: "ticket", size: "composer" },
});
