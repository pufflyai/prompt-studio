import { useEffect, useState } from "react";

export const focusPromptEditor = (container: HTMLDivElement | null) => {
  const editable = container?.querySelector('[contenteditable="true"]');
  if (editable instanceof HTMLElement) editable.focus();
};

const requestPromptEditorFocus = (container: HTMLDivElement | null, onFocus?: () => void) =>
  requestAnimationFrame(() => {
    focusPromptEditor(container);
    onFocus?.();
  });

export const useComposerFocus = (
  containerRef: { current: HTMLDivElement | null },
  autoFocus: boolean,
  focusSignal: number,
  setIsSelected: (selected: boolean) => void,
) => {
  const [submissionFocusSignal, setSubmissionFocusSignal] = useState(0);
  useEffect(() => {
    if (submissionFocusSignal === 0) return;
    // Focus after React commits the restored editor and its editable state.
    const handle = requestPromptEditorFocus(containerRef.current, () => setIsSelected(true));
    return () => cancelAnimationFrame(handle);
  }, [submissionFocusSignal, containerRef, setIsSelected]);

  useEffect(() => {
    if (!autoFocus) return;
    const handle = requestPromptEditorFocus(containerRef.current, () => setIsSelected(true));
    return () => cancelAnimationFrame(handle);
  }, [autoFocus, containerRef, setIsSelected]);

  useEffect(() => {
    if (focusSignal === 0) return;
    const handle = requestPromptEditorFocus(containerRef.current, () => setIsSelected(true));
    return () => cancelAnimationFrame(handle);
  }, [focusSignal, containerRef, setIsSelected]);

  return () => setSubmissionFocusSignal((signal) => signal + 1);
};
