export const previews = {
  "cloud-status-states": {
    source: "extensions/canvas/src/canvases/cloud-status-previews.tsx",
    exportName: "CloudStatusStates",
  },
  "cloud-popover-synced": {
    source: "extensions/canvas/src/canvases/cloud-status-previews.tsx",
    exportName: "CloudPopoverSynced",
  },
  "cloud-popover-offline": {
    source: "extensions/canvas/src/canvases/cloud-status-previews.tsx",
    exportName: "CloudPopoverOffline",
  },
  "cloud-popover-coming-soon": {
    source: "extensions/canvas/src/canvases/cloud-status-previews.tsx",
    exportName: "CloudPopoverComingSoon",
  },
  "cloud-settings-connected": {
    source: "extensions/canvas/src/canvases/cloud-settings-previews.tsx",
    exportName: "CloudSettingsConnected",
  },
  "cloud-settings-local": {
    source: "extensions/canvas/src/canvases/cloud-settings-previews.tsx",
    exportName: "CloudSettingsLocal",
  },
  "cloud-settings-coming-soon": {
    source: "extensions/canvas/src/canvases/cloud-settings-previews.tsx",
    exportName: "CloudSettingsComingSoon",
  },
  "cloud-make-local": {
    source: "extensions/canvas/src/canvases/cloud-settings-previews.tsx",
    exportName: "CloudMakeLocalConfirmation",
  },
  "long-documentation": {
    source: "packages/ui/src/foundations/documentation.canvas.tsx",
    exportName: "LongDocumentation",
  },
  "project-form": { source: "packages/ui/src/foundations/interactive-previews.canvas.tsx", exportName: "ProjectForm" },
  controls: { source: "packages/ui/src/foundations/interactive-previews.canvas.tsx", exportName: "Controls" },
  "foundation-colors": { source: "packages/ui/src/foundations/foundations.canvas.tsx", exportName: "FoundationColors" },
  "foundation-typography": {
    source: "packages/ui/src/foundations/foundations.canvas.tsx",
    exportName: "FoundationTypography",
  },
  "foundation-spacing": {
    source: "packages/ui/src/foundations/foundations.canvas.tsx",
    exportName: "FoundationSpacing",
  },
  "button-states": { source: "packages/ui/src/foundations/component-controls.canvas.tsx", exportName: "ButtonStates" },
  "field-states": { source: "packages/ui/src/foundations/component-controls.canvas.tsx", exportName: "FieldStates" },
  "selection-states": {
    source: "packages/ui/src/foundations/component-controls.canvas.tsx",
    exportName: "SelectionStates",
  },
  "feedback-states": {
    source: "packages/ui/src/foundations/component-surfaces.canvas.tsx",
    exportName: "FeedbackStates",
  },
  "badge-states": { source: "packages/ui/src/foundations/component-surfaces.canvas.tsx", exportName: "BadgeStates" },
  "surface-states": {
    source: "packages/ui/src/foundations/component-surfaces.canvas.tsx",
    exportName: "SurfaceStates",
  },
  "empty-states": { source: "packages/ui/src/foundations/component-surfaces.canvas.tsx", exportName: "EmptyStates" },
  "keyboard-states": {
    source: "packages/ui/src/foundations/component-surfaces.canvas.tsx",
    exportName: "KeyboardStates",
  },
  "overlay-states": {
    source: "packages/ui/src/foundations/component-surfaces.canvas.tsx",
    exportName: "OverlayStates",
  },
} satisfies Record<string, { source: string; exportName: string }>;
