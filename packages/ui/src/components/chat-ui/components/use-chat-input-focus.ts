import { useState } from "react";

/**
 * Track one pending focus request for the composer. The prompt editor fulfils it once it is editable,
 * so a request made while the composer is locked waits instead of being lost.
 */
export const useComposerFocus = (autoFocus: boolean, focusSignal: number) => {
  const [requested, setRequested] = useState(autoFocus || focusSignal !== 0);
  const [source, setSource] = useState({ autoFocus, focusSignal });

  if (source.autoFocus !== autoFocus || source.focusSignal !== focusSignal) {
    setSource({ autoFocus, focusSignal });
    if ((autoFocus && !source.autoFocus) || (focusSignal !== 0 && focusSignal !== source.focusSignal)) {
      setRequested(true);
    }
  }

  return {
    requested,
    request: () => setRequested(true),
    complete: () => setRequested(false),
  };
};
