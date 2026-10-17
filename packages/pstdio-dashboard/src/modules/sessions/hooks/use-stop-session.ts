import { useMutation } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api";

export const useStopSession = () =>
  useMutation({
    mutationFn: (sessionId: string) => getApiClient().sessions.updateStatus(sessionId, "cancelled"),
  });
