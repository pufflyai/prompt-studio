export const bubbleLauncherAnchors = {
  "top-left": { top: "6", left: "6", bottom: "auto", right: "auto" },
  top: { top: "6", left: "50%", bottom: "auto", right: "auto", translate: "-50% 0" },
  "top-right": { top: "6", right: "6", bottom: "auto", left: "auto" },
  left: { left: "6", top: "50%", bottom: "auto", right: "auto", translate: "0 -50%" },
  right: { right: "6", top: "50%", bottom: "auto", left: "auto", translate: "0 -50%" },
  "bottom-left": { bottom: "6", left: "6", top: "auto", right: "auto" },
  bottom: { bottom: "6", left: "50%", top: "auto", right: "auto", translate: "-50% 0" },
  "bottom-right": { bottom: "6", right: "6", top: "auto", left: "auto" },
};

export type BubbleAnchor = keyof typeof bubbleLauncherAnchors;

const inset = "calc({spacing.6} + {spacing.12} + {spacing.3})";

export const bubblePanelAnchors = {
  "top-left": { top: inset, left: "6", bottom: "auto", right: "auto", transformOrigin: "top left" },
  top: { top: inset, left: "50%", bottom: "auto", right: "auto", translate: "-50% 0", transformOrigin: "top" },
  "top-right": { top: inset, right: "6", bottom: "auto", left: "auto", transformOrigin: "top right" },
  left: { left: inset, top: "50%", bottom: "auto", right: "auto", translate: "0 -50%", transformOrigin: "left" },
  right: { right: inset, top: "50%", bottom: "auto", left: "auto", translate: "0 -50%", transformOrigin: "right" },
  "bottom-left": { bottom: inset, left: "6", top: "auto", right: "auto", transformOrigin: "bottom left" },
  bottom: { bottom: inset, left: "50%", top: "auto", right: "auto", translate: "-50% 0", transformOrigin: "bottom" },
  "bottom-right": { bottom: inset, right: "6", top: "auto", left: "auto", transformOrigin: "bottom right" },
};
