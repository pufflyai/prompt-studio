import { defineRecipe, defineSlotRecipe } from "@chakra-ui/react";

const panelMenuChromeIcon = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  w: "1.125rem",
  h: "1.125rem",
  minW: "1.125rem",
  p: "0",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "2xs",
  color: "fg.subtle",
  _icon: { w: "0.75rem", h: "0.75rem" },
} as const;

export const panelMenuSlotRecipe = defineSlotRecipe({
  className: "panel-menu",
  slots: ["root", "header", "icon", "title", "action", "content"],
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      minH: "0",
      minW: "0",
      overflow: "hidden",
      bg: "bg",
      color: "fg",
    },
    header: {
      display: "flex",
      alignItems: "center",
      flexShrink: 0,
      gap: "2xs",
      px: "2xs",
      minW: "0",
    },
    icon: panelMenuChromeIcon,
    title: {
      flex: "1",
      minW: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    action: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      cursor: "pointer",
      color: "fg.muted",
      _hover: { bg: "bg.hover", color: "fg" },
      _focusVisible: { outline: "2px solid", outlineColor: "border.focus", outlineOffset: "1px" },
    },
    content: {
      display: "flex",
      flex: "1",
      w: "full",
      minH: "0",
      minW: "0",
      overflow: "hidden",
    },
  },
  variants: {
    variant: {
      docked: {
        root: { w: "6.875rem", h: "full" },
        header: { h: "1.5rem" },
        title: { textStyle: "label/XS/medium" },
        action: { w: "1.125rem", h: "1.125rem", borderRadius: "2xs", bg: "transparent" },
      },
      dropdown: {
        root: {
          w: "11.125rem",
          maxH: "20rem",
          p: "0.3125rem",
          borderWidth: "1px",
          borderColor: "border",
          borderRadius: "0.4375rem",
        },
        header: { h: "1.25rem", px: "0" },
        title: {
          textStyle: "label/XS/medium",
          fontFamily: "heading",
          fontWeight: "600",
          letterSpacing: "0.0625rem",
          textTransform: "uppercase",
        },
        action: {
          h: "0.9375rem",
          minW: "0",
          px: "2xs",
          borderWidth: "1px",
          borderColor: "border",
          borderRadius: "0.1875rem",
          bg: "bg.muted",
          textStyle: "label/XS/medium",
        },
        content: { mt: "0.3125rem" },
      },
    },
    side: {
      left: { root: { borderRightWidth: "1px", borderRightColor: "border" } },
      right: { root: { borderLeftWidth: "1px", borderLeftColor: "border" } },
    },
  },
  compoundVariants: [
    { variant: "dropdown", side: "left", css: { root: { borderRightWidth: "1px" } } },
    { variant: "dropdown", side: "right", css: { root: { borderLeftWidth: "1px" } } },
  ],
  defaultVariants: { variant: "docked", side: "left" },
});

export const panelMenuToggleRecipe = defineRecipe({
  className: "panel-menu-toggle",
  base: {
    ...panelMenuChromeIcon,
    cursor: "pointer",
    _hover: { bg: "bg.hover", color: "fg" },
    _focusVisible: { outline: "2px solid", outlineColor: "border.focus", outlineOffset: "1px" },
  },
  variants: {
    open: {
      true: { bg: "bg.active", color: "fg" },
      false: { bg: "transparent" },
    },
  },
  defaultVariants: { open: false },
});
