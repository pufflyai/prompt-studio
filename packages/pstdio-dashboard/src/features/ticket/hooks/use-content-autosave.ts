import { useEffect, useRef, useState } from "react";

const CONTENT_SAVE_DELAY_MS = 400;

interface UseContentAutosaveInput {
  ticketId: string;
  content: string;
  onSave: (ticketId: string, content: string) => void;
}

export const useContentAutosave = (input: UseContentAutosaveInput) => {
  const { ticketId, content, onSave } = input;

  const editorKey = ticketId ? `ticket:${ticketId}` : "ticket:none";
  const [initialContent, setInitialContent] = useState(content);
  const draftContentRef = useRef(content);
  const savedContentRef = useRef(content);
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeIdRef = useRef<string | null>(ticketId || null);
  const lastKeyRef = useRef(editorKey);

  const flush = () => {
    if (!activeIdRef.current) return;
    const next = draftContentRef.current;
    if (savedContentRef.current === next) return;
    savedContentRef.current = next;
    onSave(activeIdRef.current, next);
  };

  useEffect(
    () => () => {
      if (pendingRef.current) clearTimeout(pendingRef.current);
      const id = activeIdRef.current;
      if (!id) return;
      const next = draftContentRef.current;
      if (savedContentRef.current === next) return;
      savedContentRef.current = next;
      onSave(id, next);
    },
    [onSave],
  );

  useEffect(() => {
    if (lastKeyRef.current === editorKey) return;
    lastKeyRef.current = editorKey;
    activeIdRef.current = ticketId || null;
    draftContentRef.current = content;
    savedContentRef.current = content;
    setInitialContent(content);
  }, [content, editorKey, ticketId]);

  const handleChange = (value: string) => {
    draftContentRef.current = value;
    if (pendingRef.current) clearTimeout(pendingRef.current);
    pendingRef.current = setTimeout(() => {
      pendingRef.current = null;
      flush();
    }, CONTENT_SAVE_DELAY_MS);
  };

  return { editorKey, initialContent, handleChange };
};
