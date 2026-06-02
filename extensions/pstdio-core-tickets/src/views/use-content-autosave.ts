import { useEffect, useRef, useState } from "react";
import { createContentAutosave } from "./autosave";

interface UseContentAutosaveInput {
  id: string;
  initialContent: string;
  save: (id: string, content: string) => Promise<void>;
  delayMs?: number;
}

// React wrapper around the pure autosave engine. Re-initializes when the open
// ticket changes and flushes pending edits on teardown (ticket switch, unmount,
// or the page being hidden) so navigating away never drops edits.
export const useContentAutosave = ({ id, initialContent, save, delayMs }: UseContentAutosaveInput) => {
  const saveRef = useRef(save);
  saveRef.current = save;

  const engineRef = useRef<ReturnType<typeof createContentAutosave> | undefined>(undefined);
  if (!engineRef.current) {
    engineRef.current = createContentAutosave({
      save: (ticketId, content) => saveRef.current(ticketId, content),
      delayMs,
    });
  }
  const engine = engineRef.current;

  const [editorKey, setEditorKey] = useState(id);

  useEffect(() => {
    engine.reset(id, initialContent);
    setEditorKey(id);
  }, [engine, id, initialContent]);

  useEffect(() => {
    const flush = () => void engine.flush();
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", flush);
      void engine.flush();
    };
  }, [engine]);

  return {
    editorKey,
    handleChange: (content: string) => engine.change(content),
    flush: () => engine.flush(),
  };
};
