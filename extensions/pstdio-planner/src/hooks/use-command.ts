import { type CommandResponse, type GuestHost, unwrapCommandOutcome } from "@pstdio/sdk/extensions";
import { type QueryKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTicketHost } from "./host-context";

// Executes an extension command and unwraps its outcome, throwing on failure so
// react-query can surface the error. This is the single place panels talk to the host.
export const runCommand = async <TResult>(
  host: GuestHost,
  commandId: string,
  params?: Record<string, unknown>,
  fallback?: string,
) => {
  const response = await host.call<CommandResponse<TResult>>("commands.execute", { commandId, params });
  return unwrapCommandOutcome<TResult>(response, fallback);
};

interface CommandQueryInput {
  queryKey: QueryKey;
  commandId: string;
  params?: Record<string, unknown>;
  enabled?: boolean;
}

// Reads server state via a command, cached and deduped by react-query.
export const useCommandQuery = <TResult>({ queryKey, commandId, params, enabled }: CommandQueryInput) => {
  const { host } = useTicketHost();
  return useQuery({
    queryKey,
    enabled,
    queryFn: () => runCommand<TResult>(host, commandId, params),
  });
};

interface CommandMutationInput {
  commandId: string;
  invalidate?: QueryKey[];
}

// Writes server state via a command and refreshes any affected queries on success.
export const useCommandMutation = <TResult = unknown>({ commandId, invalidate }: CommandMutationInput) => {
  const { host } = useTicketHost();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params?: Record<string, unknown>) => runCommand<TResult>(host, commandId, params),
    onSuccess: () => invalidate?.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey })),
  });
};
