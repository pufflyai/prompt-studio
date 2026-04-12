import { useEffect, useState } from "react";
import { getTicketFileContent } from "@/features/ticket-list/data/api";

export const useArtifactContent = (ticketId: string | null, fileId: string | null) => {
  const [data, setData] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!ticketId || !fileId) {
      setData(undefined);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    void getTicketFileContent(ticketId, fileId, controller.signal)
      .then((content) => {
        if (!controller.signal.aborted) setData(content);
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") return;
        if (!controller.signal.aborted) setData("");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [ticketId, fileId]);

  return { data, isLoading };
};
