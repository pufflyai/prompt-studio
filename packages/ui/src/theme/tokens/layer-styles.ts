import { defineLayerStyles } from "@chakra-ui/react";

const compactDropZone = {
  _after: {
    content: '""',
    position: "absolute",
    top: "50%",
    left: "50%",
    width: "12",
    height: "1.5",
    transform: "translate(-50%, -50%)",
    borderRadius: "pill",
    bg: "bg.drop.muted/40",
    pointerEvents: "none",
  },
  "&[data-orientation=vertical]::after": { width: "1.5", height: "12" },
  "&[data-drop-active]::after": { bg: "bg.drop" },
} as const;

export const layerStyles = defineLayerStyles({
  documentContent: { value: { width: "full", minWidth: "0", maxWidth: "document-content", marginInline: "auto" } },
  resourceActivityNotice: {
    value: { minWidth: "0", color: "fg.muted", bg: "bg.muted", padding: "xs", borderRadius: "xs" },
  },
  documentNotice: {
    value: {
      position: "sticky",
      bottom: "0",
      minWidth: "0",
      zIndex: "1",
      bg: "bg.muted",
      borderTopWidth: "1px",
      borderColor: "border.muted",
      paddingInline: "sm",
      paddingBlock: "xs",
    },
  },
  chatContent: {
    value: {
      width: "full",
      minWidth: "0",
      maxWidth: "chat-content",
      marginInline: "auto",
    },
  },
  settingsHeader: {
    value: {
      padding: "lg",
      bg: "bg",
      borderBottomWidth: "1px",
      borderColor: "border.subtle",
    },
  },
  // A bordered choice in a dialog. The card holding the checked radio takes the accent border.
  optionCard: {
    value: {
      padding: "sm",
      borderWidth: "1px",
      borderColor: "border.subtle",
      borderRadius: "compact",
      "&:has(input:checked)": { borderColor: "border.accent" },
    },
  },
  markdownEditorInset: {
    value: {
      padding: "lg",
    },
  },
  statusBarItem: {
    value: {
      position: "relative",
      minWidth: "0",
      height: "full",
      "&[data-sortable]": { cursor: "grab" },
      "&[data-dragging]": { opacity: 0.5 },
    },
  },
  dropIndicator: {
    value: {
      position: "absolute",
      zIndex: "1",
      borderRadius: "2xs",
      bg: "bg.drop",
      pointerEvents: "none",
    },
  },
  tabDropZone: { value: compactDropZone },
  panelDropZone: { value: compactDropZone },
  bubbleButton: { value: { aspectRatio: "square" } },
  dropTarget: {
    value: {
      bg: "bg.drop/20",
      _hover: { bg: "bg.drop/20" },
      _focusVisible: { bg: "bg.drop/20" },
      // List rows and section headers must let their active drop surface show through.
      "& .group": {
        bg: "transparent",
        _hover: { bg: "transparent" },
        _active: { bg: "transparent" },
        _focusVisible: { bg: "transparent" },
      },
    },
  },
  panelSnapIndicator: {
    value: {
      width: "12",
      height: "1.5",
      borderRadius: "pill",
      bg: "bg.drop.muted/40",
      boxShadow: "sm",
      "&[data-drop-active]": { bg: "bg.drop" },
      "&[data-drop-surface=bubble]": {
        height: "12",
        borderRadius: "full",
        boxShadow: "none",
      },
    },
  },
  floatingPanelResizeHandle: {
    value: {
      position: "absolute",
      zIndex: "2",
      padding: "0",
      border: "0",
      bg: "transparent",
      color: "fg.muted",
      top: "0",
      left: "0",
      width: "3",
      height: "3",
      cursor: "nwse-resize",
      _before: {
        content: '""',
        position: "absolute",
        top: "0.5",
        left: "0.5",
        width: "2",
        height: "2",
        borderTopWidth: "2px",
        borderLeftWidth: "2px",
        borderTopLeftRadius: "xs",
        borderColor: "currentColor",
        pointerEvents: "none",
        opacity: "0",
      },
      "&[data-resize-direction=ne]": {
        left: "auto",
        right: "0",
        cursor: "nesw-resize",
        _before: {
          left: "auto",
          right: "0.5",
          borderLeftWidth: "0",
          borderRightWidth: "2px",
          borderTopLeftRadius: "0",
          borderTopRightRadius: "xs",
        },
      },
      _hover: { _before: { opacity: "1" } },
      _active: { _before: { opacity: "1" } },
      _focusVisible: {
        outline: "1px solid",
        outlineColor: "fg.muted",
        outlineOffset: "-1px",
        _before: { opacity: "1" },
      },
    },
  },
  panelDragSurface: {
    value: {
      "&[data-panel-draggable]": { cursor: "grab" },
      "&[data-panel-draggable]:has(:is(button, a, input, textarea, select, iframe, [role=tab], [role=treeitem], [role=button], [role=menuitem], [contenteditable=true]):hover)":
        {
          cursor: "auto",
        },
      "&[data-panel-dragging]": { cursor: "grabbing" },
    },
  },
  panelDragging: { value: { cursor: "grabbing" } },
  mirroredIcon: { value: { transform: "scaleX(-1)" } },
  filterPicker: {
    value: {
      height: "min({sizes.filter-picker-height}, calc(100dvh - {spacing.xl}))",
    },
  },
  filterLabel: {
    value: {
      paddingInline: "xs",
      borderRightWidth: "1px",
      borderColor: "border.subtle",
      height: "full",
      display: "inline-flex",
    },
  },
  filterPill: {
    value: {
      height: "filter-pill",
      borderWidth: "1px",
      borderColor: "border.subtle",
      borderRadius: "xs",
      bg: "bg.muted",
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
        borderColor: "bg.drop",
        bg: "bg.drop/20",
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
