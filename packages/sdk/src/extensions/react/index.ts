import { type QueryKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface CommandQueryInput<TResult> {
  queryKey: QueryKey;
  command: () => Promise<TResult>;
  enabled?: boolean;
  staleTime?: number;
}

/** Reads server state via a typed client command, cached and deduped by react-query. */
export const useCommandQuery = <TResult>(input: CommandQueryInput<TResult>) => {
  const { command, enabled, queryKey, staleTime } = input;
  return useQuery({
    queryKey,
    enabled,
    staleTime,
    queryFn: () => command(),
  });
};

interface CommandMutationInput<TParams, TResult> {
  command: (params: TParams) => Promise<TResult>;
  invalidate?: QueryKey[];
}

/** Writes server state via a typed client command and refreshes affected queries on success. */
export const useCommandMutation = <TParams, TResult>(input: CommandMutationInput<TParams, TResult>) => {
  const { command, invalidate } = input;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: TParams) => command(params),
    onSuccess: () => invalidate?.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey })),
  });
};
