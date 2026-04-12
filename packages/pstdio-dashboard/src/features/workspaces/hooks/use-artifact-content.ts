import { useEffect, useState } from "react";
import { getTicketFileContent } from "@/features/ticket-list/data/api";

const isAbortError = (error: unknown) => error instanceof Error && error.name === "AbortError";

export const loadArtifactContent = async (
  ticketId: string,
  fileId: string,
  signal: AbortSignal,
  loadContent = getTicketFileContent,
) => {
  try {
    const content = await loadContent(ticketId, fileId, signal);
    return { content, error: null, aborted: false };
  } catch (error) {
    if (isAbortError(error) || signal.aborted) {
      return { content: undefined, error: null, aborted: true };
    }

    return {
      content: "",
      error: "Failed to load artifact content.",
      aborted: false,
    };
  }
};

export const useArtifactContent = (ticketId: string | null, fileId: string | null) => {
  const [data, setData] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticketId || !fileId) {
      setData(undefined);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setData(undefined);
    setIsLoading(true);
    setError(null);

    void loadArtifactContent(ticketId, fileId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted || result.aborted) return;
        setData(result.content);
        setError(result.error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [ticketId, fileId]);

  return { data, isLoading, error };
};
