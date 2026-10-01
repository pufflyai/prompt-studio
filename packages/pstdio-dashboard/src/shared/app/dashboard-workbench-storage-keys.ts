// Saved alpha.8 layouts carry the removed defaultOpen/required placement
// lifecycle and cannot seed the alpha.9 presence model; a new namespace
// discards them instead of guessing.
export const dashboardWorkbenchStorageNamespace = "dashboard-wb2";

export const dashboardProjectSelectionStorageKey = (namespace: string) => `${namespace}:selected-project:global`;
