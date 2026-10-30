import type { BenchmarkUnit } from "./writer";

const limit = (value: number, unit: BenchmarkUnit, establishedAt: string, evidence: string) => ({
  value,
  unit,
  establishedAt,
  evidence,
});

const hosted = "Four hosted ubuntu-24.04 runs; budget includes about 20% headroom.";
export const workbenchBudgets = {
  projectSwitch: limit(1850, "ms", "2026-10-26", `${hosted} Slowest switch 1,533 ms.`),
  projectSwitchLongTask: limit(
    525,
    "ms",
    "2026-10-27",
    `${hosted} Slowest first-switch task 419 ms; corrected sample coverage.`,
  ),
  resourceHierarchy: limit(675, "ms", "2026-10-26", `${hosted} Slowest 547 ms.`),
  resourceHierarchyLongTask: limit(750, "ms", "2026-10-26", `${hosted} Slowest task 609 ms.`),
  navChrome: limit(875, "ms", "2026-10-26", `${hosted} Slowest 721 ms.`),
  panelTabs: limit(800, "ms", "2026-10-26", `${hosted} Slowest 664 ms.`),
  sidenavHeader: limit(425, "ms", "2026-10-26", `${hosted} Slowest 336 ms.`),
  sidePanel: limit(325, "ms", "2026-10-26", `${hosted} Slowest 267 ms.`),
  interactions: limit(450, "ms", "2026-10-26", `${hosted} Slowest 356.5 ms.`),
  interactionLongTask: limit(200, "ms", "2026-10-26", `${hosted} Slowest task 148 ms.`),
};

export const subnavBudgets = {
  structureMs: limit(375, "ms", "2026-10-26", `${hosted} Slowest 293 ms.`),
  dataMs: limit(1525, "ms", "2026-10-26", `${hosted} Slowest 1,263 ms.`),
  editorMs: limit(1325, "ms", "2026-10-26", `${hosted} Slowest 1,089 ms.`),
};
export const plannerBudget = limit(3000, "ms", "2026-10-26", `${hosted} Slowest cold open 2,426 ms.`);
export const collectionBudget = limit(
  1250,
  "ms",
  "2026-10-23",
  "PS-902: user-approved temporary ceiling after CI measured 1,005–1,064 ms. The 1,000 ms product target remains unmet; restore it after proof.",
);

// These values predate this standard. Retain their original numbers; absent measurement evidence
// is stated rather than invented. Future changes must attach the approving measurements.
const chatEvidence =
  "Existing chat performance scenario limit, retained from before PS-924; no dated baseline was recorded with the original constant.";
export const chatBudgets = {
  largeConversationReadyMs: limit(20000, "ms", "unrecorded", chatEvidence),
  sessionSwitchMs: limit(10000, "ms", "unrecorded", chatEvidence),
  streamingCompleteMs: limit(30000, "ms", "unrecorded", chatEvidence),
  totalLongTaskMs: limit(20000, "ms", "unrecorded", chatEvidence),
  switchStartMs: limit(500, "ms", "2026-10-26", "Hosted ubuntu-24.04 slowest 407 ms plus about 20%."),
};

const desktopEvidence =
  "User-approved 2026-10-10 release rehearsal: Intel cold launch 23.3 s, Windows 8.2 s; about 20% headroom. See the desktop benchmark section of the testing guide.";
export const desktopBudgets = (platform = process.platform, arch = process.arch) => {
  const intelMac = platform === "darwin" && arch === "x64";
  const cold = platform === "win32" ? 10000 : 8000;
  const macWindow = intelMac ? 10000 : 1500;
  return {
    coldStartMs: limit(intelMac ? 28000 : cold, "ms", "2026-10-10", desktopEvidence),
    startupWindowMs: limit(platform === "darwin" ? macWindow : 1000, "ms", "2026-10-10", desktopEvidence),
    warmAttachMs: limit(3000, "ms", "2026-10-10", desktopEvidence),
    recoveryMs: limit(500, "ms", "2026-10-10", desktopEvidence),
  };
};
export const rendererBudgets = {
  idleScript: limit(0.02, "share", "2026-10-10", "Idle main-thread script budget from the desktop release rehearsal."),
  idleTask: limit(0.05, "share", "2026-10-10", "Idle main-thread task budget from the desktop release rehearsal."),
  streamingScript: limit(
    0.85,
    "share",
    "2026-10-10",
    "Streaming replay measured up to 69% script time; approved headroom.",
  ),
  streamingTask: limit(
    1.2,
    "share",
    "2026-10-10",
    "Streaming replay measured up to 99% task time; approved headroom. Above 1 does not independently constrain task share.",
  ),
  monitoringMainCpu: limit(
    10,
    "percent",
    "unrecorded",
    "Existing desktop monitoring CPU budget; retained without changing its value.",
  ),
};
export const relayStorageBudget = limit(
  1,
  "share",
  "unrecorded",
  "PRD 0014 R23: stored bytes stay below twice the latest state size plus the grace-period copy. This ratio is a product storage bound, not a timing measurement.",
);
