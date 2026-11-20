// Placeholder UI drawn on box tops. Text is greeked into bars on purpose: at this angle
// it would be unreadable, and fewer real words keeps each scene quiet.

export type ToolKind = "page" | "command" | "skill" | "automation" | "editor";

const TOOL_BODY: Record<ToolKind, string> = {
  page: '<div class="g-board"><i></i><i></i><i></i></div>',
  command: '<div class="g-cmd"><b></b><span class="g-lines"></span></div>',
  skill: '<span class="g-lines"></span>',
  automation: '<div class="g-clock"><b></b><span class="g-lines"></span></div>',
  editor: '<div class="g-canvas"></div>',
};

export const kindColor = (kind: ToolKind) => `var(--chakra-colors-illustration-${kind})`;
export const ISO_ACCENT = "var(--chakra-colors-illustration-accent)";
export const ISO_SURFACE = "var(--chakra-colors-bg-panel)";
export const ISO_TINT = "color-mix(in oklab, var(--chakra-colors-bg-panel), var(--chakra-colors-fg) 6%)";

export const workbench = (tabs = 0) => {
  const tabBar = tabs
    ? `<span class="g-tabs">${Array.from({ length: tabs }, (_, i) => `<b${i === tabs - 1 ? ' class="g-on"' : ""}></b>`).join("")}<b class="g-plus"></b></span>`
    : "";
  return `<div class="g-wb"><i class="g-title"></i>${tabBar}<i class="g-side"></i><i class="g-main"></i><i class="g-status"></i></div>`;
};

export const slab = () => '<div class="g-wb"><i class="g-title"></i></div>';
export const tool = (kind: ToolKind) =>
  `<div class="g-tool"><i class="g-head" style="background:${kindColor(kind)}"></i>${TOOL_BODY[kind]}</div>`;
export const file = () => '<div class="g-file"><i></i><span class="g-lines g-grow"></span></div>';
export const lines = () => '<span class="g-lines g-tight"></span>';
export const card = () => '<span class="g-lines g-card"></span>';
export const kpi = () => '<div class="g-kpi"><b></b><i></i></div>';
export const note = () =>
  '<div class="g-note"><i class="g-title"></i><span class="g-lines g-top"></span><div class="g-slot"></div><span class="g-lines g-bottom"></span></div>';
export const clock = () => '<div class="g-clockface"></div>';
export const wave = () => '<div class="g-wave"></div>';
export const grid = () => '<div class="g-grid"></div>';
export const wire = () => '<div class="g-wire"></div>';
export const screen = () => '<div class="g-screen"></div>';
export const stripes = () => '<div class="g-stripes"></div>';
export const cardFront = () => '<div class="g-cardfront"></div>';
export const bars = () => '<div class="g-bars3"><i></i><i></i><i></i></div>';
export const live = (values: number[]) =>
  `<div class="g-live">${values.map((v) => `<i style="height:${v}%"></i>`).join("")}</div>`;
