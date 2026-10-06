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
  editable: boolean,
  focusSignal: number,
  setIsSelected: (selected: boolean) => void,
) => {
  const [submissionFocusPending, setSubmissionFocusPending] = useState(false);
  useEffect(() => {
    if (!submissionFocusPending || !editable) return;
    // The parent can remain disabled after the submission promise resolves. Keep the
    // focus request until the editor becomes editable, then consume it once.
    const handle = requestPromptEditorFocus(containerRef.current, () => {
      setIsSelected(true);
      setSubmissionFocusPending(false);
    });
    return () => cancelAnimationFrame(handle);
  }, [submissionFocusPending, editable, containerRef, setIsSelected]);

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

  return () => setSubmissionFocusPending(true);
};
