import { useEffect, useState } from "react";
import { getProjectTicketContent, getTicketFileContent } from "@/features/ticket-list/data/api";
import { TICKET_CONTENT_ITEM_ID } from "../utils/ticket-file-selection";

interface UseTicketContentOptions {
  enabled?: boolean;
  refreshKey?: string;
}

export const useTicketContent = (
  ticketId: string | null | undefined,
  selectedFileId: string,
  options: UseTicketContentOptions = {},
) => {
  const { enabled = true, refreshKey } = options;
  const refreshToken = refreshKey ?? selectedFileId;
  const [data, setData] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!ticketId || !enabled) {
      setData(undefined);
      setIsLoading(false);
      return;
    }

    if (!refreshToken) return;

    const controller = new AbortController();
    setIsLoading(true);

    const contentPromise =
      selectedFileId === TICKET_CONTENT_ITEM_ID
        ? getProjectTicketContent(ticketId, controller.signal)
        : getTicketFileContent(ticketId, selectedFileId, controller.signal);

    void contentPromise
      .then((content) => {
        if (!controller.signal.aborted) {
          setData(content);
        }
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        if (!controller.signal.aborted) {
          setData("");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [enabled, refreshToken, selectedFileId, ticketId]);

  const setOptimisticContent = (nextContent: string) => {
    setData(nextContent);
  };

  return { data, isLoading, setOptimisticContent };
};
