import { defineSlotRecipe } from "@chakra-ui/react";
import { colorPickerAnatomy } from "@chakra-ui/react/anatomy";

const interactiveBorderColor = "border.accent-light";

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
      outline: "none",
      boxShadow: "none",
      _hover: {
        borderColor: interactiveBorderColor,
      },
      _active: {
        borderColor: interactiveBorderColor,
      },
      _focusWithin: {
        borderColor: interactiveBorderColor,
        boxShadow: "none",
      },
      "&:is(:hover, [data-hover])": {
        borderColor: interactiveBorderColor,
      },
      "&:is(:active, [data-active])": {
        borderColor: interactiveBorderColor,
      },
      "& [data-scope=color-picker][data-part=trigger]": {
        border: "0",
        borderInlineStartWidth: "0",
        boxShadow: "none",
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
      borderInlineEndWidth: "0",
      borderRadius: "0",
      outline: "none",
      boxShadow: "none",
      textStyle: "label/S/regular",
      _focusVisible: {
        outline: "none",
        boxShadow: "none",
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
      border: "0",
      borderInlineStartWidth: "0",
      borderRadius: "0",
      outline: "none",
      boxShadow: "none",
      _hover: {
        bg: "bg.hover",
      },
      _focusVisible: {
        outline: "none",
        boxShadow: "none",
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
        outlineColor: interactiveBorderColor,
      },
    },
  },
  variants: {
    size: {
      xs: {
        control: {
          h: "1.75rem",
        },
        channelInput: {
          px: "xs",
          textStyle: "label/XS",
        },
        trigger: {
          minW: "1.75rem",
          px: "2xs",
        },
      },
      sm: {},
    },
  },
  defaultVariants: {
    size: "sm",
  },
});
