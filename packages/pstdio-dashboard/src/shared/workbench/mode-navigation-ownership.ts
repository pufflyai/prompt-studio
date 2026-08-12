// Modes that stage their own navigation chrome (an activity rail) own navigation:
// while such a mode is active the dashboard must not re-open its default sidenav.
const owningModeIds = new Set<string>();

export const registerNavigationOwningMode = (modeId: string) => {
  owningModeIds.add(modeId);
  return { dispose: () => owningModeIds.delete(modeId) };
};

export const modeOwnsNavigation = (modeId: string | undefined) => Boolean(modeId && owningModeIds.has(modeId));
