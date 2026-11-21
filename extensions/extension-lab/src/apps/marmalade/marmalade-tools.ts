import { l10n } from "@pstdio/sdk/extensions";

export const marmaladeTools = [
  { id: "move", label: l10n("marmalade.tools.move", "Move tool"), icon: "Move", key: "V" },
  { id: "text", label: l10n("marmalade.tools.text", "Text tool"), icon: "Type", key: "T" },
  { id: "rectangle", label: l10n("marmalade.tools.rectangle", "Rectangle tool"), icon: "Square", key: "R" },
  { id: "ellipse", label: l10n("marmalade.tools.ellipse", "Ellipse tool"), icon: "Circle", key: "E" },
  { id: "brush", label: l10n("marmalade.tools.brush", "Brush tool"), icon: "Paintbrush", key: "B" },
  { id: "hand", label: l10n("marmalade.tools.hand", "Hand tool"), icon: "Hand", key: "H" },
  { id: "zoom", label: l10n("marmalade.tools.zoom", "Zoom tool"), icon: "ZoomIn", key: "Z" },
] as const;
