import type { TextEditingSession } from "@pstdio/sdk/extensions";
import { useEffect, useRef, useState } from "react";
import type { NativeTextPresentation } from "../../../extensions/bridge/native-text-presentation";
import { createRetainedTextPresentation } from "../../../extensions/bridge/retained-text-presentation";

export const usePublicTextPresentation = (connect: () => NativeTextPresentation, open: boolean) => {
  const connectRef = useRef(connect);
  connectRef.current = connect;
  const [session, setSession] = useState<TextEditingSession>();
  const [openingError, setOpeningError] = useState<string>();
  const retryRef = useRef<() => Promise<void>>(async () => {});
  const [presentation] = useState(() => createRetainedTextPresentation(() => connectRef.current()));
  useEffect(() => {
    // Retained views keep their document DOM while their public authority closes and reopens.
    setOpeningError(undefined);
    if (!open) return;
    let mounted = true;
    const receive = async (operation: () => Promise<TextEditingSession | undefined>) => {
      setOpeningError(undefined);
      try {
        // An effect probe can retire this mount before it admits any host work.
        // Once admitted, the retained presentation still drains its normal close barrier.
        await Promise.resolve();
        if (!mounted) return;
        const value = await operation();
        if (mounted && value) setSession(value);
      } catch (error) {
        if (mounted) setOpeningError(error instanceof Error ? error.message : String(error));
      }
    };
    retryRef.current = () => receive(presentation.retry);
    void receive(presentation.open);
    return () => {
      mounted = false;
      retryRef.current = async () => {};
      void presentation.close().catch(() => {});
    };
  }, [open, presentation]);
  return { session, openingError, presentation, retry: () => retryRef.current() };
};
