import type { IssueAutomationTokenInput } from "@pstdio/sdk/api";
import { getWorkbenchOperations } from "@pstdio/workbench";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeState } from "@/lib/sync/runtime-state";
import { acceptMachineTokenRevocation, createMachineTokenOperations } from "./machine-token-operations";

const getMachineTokens = createRuntimeState((owner) => {
  const queries = getDashboardScopedQueries(owner);
  const api = getRuntimeApiClient(owner).automation;
  const actions = createMachineTokenOperations(getWorkbenchOperations(queries), api);
  return { api, actions, scope: queries.getScope };
});

export const useMachineTokens = (projectId: string) => {
  const { api, actions, scope } = getMachineTokens();
  useSyncExternalStore(actions.subscribe, actions.snapshot, actions.snapshot);
  const authority = scope();
  const scopeKey = [authority.runtimeId, authority.accountOrigin, authority.accountId, projectId];
  const queryKey = ["automation-tokens", ...scopeKey];
  const client = useQueryClient();
  const tokens = useQuery({
    queryKey,
    enabled: Boolean(projectId),
    queryFn: ({ signal }) => api.listTokens(projectId, { signal }),
  });
  const issue = useMutation({
    mutationFn: (draft: Omit<IssueAutomationTokenInput, "projectId">) => actions.issue({ ...draft, projectId }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey, exact: true });
    },
  });
  const revoke = useMutation({
    mutationFn: (tokenId: string) =>
      actions.revoke(projectId, tokenId, (result) => {
        void client.cancelQueries({ queryKey, exact: true }, { revert: false });
        client.setQueryData<typeof result>(queryKey, (current) =>
          acceptMachineTokenRevocation(current, result, tokenId),
        );
      }),
  });
  const presentation = actions.project(projectId);
  return { tokens, issue, revoke, presentation, formKey: JSON.stringify(scopeKey) };
};
