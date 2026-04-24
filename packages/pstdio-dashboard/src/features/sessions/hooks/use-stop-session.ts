import { useMutation } from "@tanstack/react-query";
import { type CollectionWriter, getWriter } from "@/features/sync/collections";
import { stopSession } from "../data/api";

interface StopSessionMutationDependencies {
  upsert: CollectionWriter["upsert"];
}

export const createStopSessionMutationOptions = (dependencies?: StopSessionMutationDependencies) => ({
  mutationFn: stopSession,
  onSuccess: (session: Awaited<ReturnType<typeof stopSession>>) => {
    const upsert = dependencies?.upsert ?? getWriter("sessions")?.upsert;
    upsert?.(session);
  },
});

export const useStopSession = () => useMutation(createStopSessionMutationOptions());
