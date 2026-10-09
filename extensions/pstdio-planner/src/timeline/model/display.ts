// Read only supported display settings; feature tracks are owned by ticket properties.
import type { DisplaySettings } from "../contracts";

export const defaultDisplay: DisplaySettings = {
  showDone: true,
  showCompletedPastDeadlines: true,
  attentionOnly: false,
  squareArrows: false,
};

export const readDisplay = (stored: Partial<DisplaySettings> | undefined): DisplaySettings => ({
  showDone: stored?.showDone ?? true,
  showCompletedPastDeadlines: stored?.showCompletedPastDeadlines ?? true,
  attentionOnly: stored?.attentionOnly ?? false,
  squareArrows: stored?.squareArrows ?? false,
});
