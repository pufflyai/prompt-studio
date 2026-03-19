import { useEffect, useRef, useState } from "react";

const CONTENT_SAVE_DELAY_MS = 400;

interface UseContentAutosaveInput {
  scopeKey: string;
  saveTargetId: string;
  content: string;
  onSave: (saveTargetId: string, content: string) => void | Promise<void>;
}

export const useContentAutosave = (input: UseContentAutosaveInput) => {
  const { scopeKey, saveTargetId, content, onSave } = input;
  const [editorRevision, setEditorRevision] = useState(0);
  const [initialContent, setInitialContent] = useState(content);
  const draftContentRef = useRef(content);
  const savedContentRef = useRef(content);
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeIdRef = useRef<string | null>(saveTargetId || null);
  const lastKeyRef = useRef(scopeKey);
  const hasLocalEditsRef = useRef(false);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const flush = async () => {
    if (!activeIdRef.current) return;
    const next = draftContentRef.current;
    if (savedContentRef.current === next) return;
    savedContentRef.current = next;
    await onSaveRef.current(activeIdRef.current, next);
    setInitialContent((current) => (current === next ? current : next));
  };

  useEffect(() => {
    return () => {
      if (pendingRef.current) clearTimeout(pendingRef.current);
      const id = activeIdRef.current;
      if (!id) return;
      const next = draftContentRef.current;
      if (savedContentRef.current === next) return;
      savedContentRef.current = next;
      void onSaveRef.current(id, next);
    };
  }, []);

  useEffect(() => {
    if (lastKeyRef.current === scopeKey) return;

    if (pendingRef.current) {
      clearTimeout(pendingRef.current);
      pendingRef.current = null;
    }

    lastKeyRef.current = scopeKey;
    activeIdRef.current = saveTargetId || null;
    draftContentRef.current = content;
    savedContentRef.current = content;
    hasLocalEditsRef.current = false;
    setInitialContent(content);
    setEditorRevision((revision) => revision + 1);
  }, [content, saveTargetId, scopeKey]);

  useEffect(() => {
    if (lastKeyRef.current !== scopeKey) return;
    if (pendingRef.current) return;
    if (draftContentRef.current !== savedContentRef.current) return;
    if (hasLocalEditsRef.current) return;
    if (savedContentRef.current === content) return;

    draftContentRef.current = content;
    savedContentRef.current = content;
    setInitialContent(content);
    setEditorRevision((revision) => revision + 1);
  }, [content, scopeKey]);

  const handleChange = (value: string) => {
    hasLocalEditsRef.current = true;
    draftContentRef.current = value;
    if (pendingRef.current) clearTimeout(pendingRef.current);
    pendingRef.current = setTimeout(() => {
      pendingRef.current = null;
      void flush();
    }, CONTENT_SAVE_DELAY_MS);
  };

  const flushPending = async () => {
    if (pendingRef.current) {
      clearTimeout(pendingRef.current);
      pendingRef.current = null;
    }
    await flush();
  };

  return { editorKey: `${scopeKey}:${editorRevision}`, initialContent, handleChange, flushPending };
};
