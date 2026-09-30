// Proposed values. Change these only after recording a visual review decision.
export const motionPresets = { instant: 0, subtle: 1, slower: 1.5 } as const;
export type Preset = keyof typeof motionPresets;
export const timings = {
  message: 160,
  firstResponse: 140,
  loader: 120,
  textChunk: 240,
  textWords: 600,
  toolStatus: 100,
  details: 160,
  rowSpace: 140,
  rowFade: 80,
  rowRemove: 120,
  panelOpen: 180,
  panelClose: 140,
  surfaceEnter: 100,
  surfaceExit: 75,
  dialogEnter: 140,
  dialogExit: 100,
  tabClose: 120,
  treeExpand: 160,
  treeCollapse: 120,
} as const;
export const loaderCycleSeconds = 1.2;
export const tooltipDelaySeconds = 0.3;
