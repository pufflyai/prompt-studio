import { defineSlotRecipe } from "@chakra-ui/react";
import { colorPickerAnatomy } from "@chakra-ui/react/anatomy";

export const colorPickerSlotRecipe = defineSlotRecipe({
  slots: colorPickerAnatomy.keys(),
  base: {
    control: {
      display: "flex",
      alignItems: "center",
      width: "full",
      minW: "0",
      h: "2rem",
      bg: "bg",
      color: "fg",
      border: "1px solid",
      borderColor: "border",
      borderRadius: "xs",
      overflow: "hidden",
      transition: "border-color 0.2s ease-in-out",
      _hover: {
        borderColor: "border",
      },
      _focusWithin: {
        borderColor: "border.accent",
      },
      "&:is(:hover, [data-hover])": {
        borderColor: "border",
      },
      "& [data-scope=color-picker][data-part=trigger]": {
        borderWidth: "0",
      },
    },
    channelInput: {
      h: "full",
      minW: "0",
      flex: "1",
      px: "sm",
      bg: "transparent",
      color: "fg",
      border: "0",
      borderRadius: "0",
      outline: "none",
      textStyle: "label/S/regular",
      _focusVisible: {
        outline: "none",
      },
    },
    trigger: {
      h: "full",
      minH: "0",
      maxH: "full",
      minW: "2rem",
      alignSelf: "stretch",
      px: "xs",
      bg: "transparent",
      color: "fg",
      borderWidth: "0",
      borderRadius: "0",
      _hover: {
        bg: "bg.hover",
      },
    },
    content: {
      p: "sm",
      bg: "bg",
      color: "fg",
      borderWidth: "0",
      borderRadius: "xs",
    },
    swatch: {
      borderRadius: "2xs",
      borderWidth: "0",
    },
    swatchTrigger: {
      borderRadius: "2xs",
      _focusVisible: {
        outline: "1px solid",
        outlineColor: "border.accent",
      },
    },
  },
});
