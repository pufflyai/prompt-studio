import { useEffect, useState } from "react";
import { getProjectTicketContent } from "@/features/ticket-list/data/api";

export const useTicketContent = (ticketId: string | null | undefined) => {
  const [data, setData] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!ticketId) {
      setData(undefined);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    void getProjectTicketContent(ticketId, controller.signal)
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
  }, [ticketId]);

  const setOptimisticContent = (nextContent: string) => {
    setData(nextContent);
  };

  return { data, isLoading, setOptimisticContent };
};
