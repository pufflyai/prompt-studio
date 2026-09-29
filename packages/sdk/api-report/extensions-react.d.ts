import { QueryKey, UseQueryResult } from "@tanstack/react-query";
interface CommandQueryInput<TResult> {
  queryKey: QueryKey;
  command: () => Promise<TResult>;
  enabled?: boolean;
  staleTime?: number;
}
export declare const useCommandQuery: <TResult>(input: CommandQueryInput<TResult>) => UseQueryResult<TResult>;
interface CommandMutationInput<TParams, TResult> {
  command: (params: TParams) => Promise<TResult>;
  invalidate?: QueryKey[];
}
export declare const useCommandMutation: <TParams, TResult>(input: CommandMutationInput<TParams, TResult>) => import("@tanstack/react-query").UseMutationResult<TResult, Error, TParams, unknown>;
