import type { IssueAutomationTokenInput, ListAutomationTokensResponse } from "@pstdio/sdk/api";
import type { AutomationClient } from "@pstdio/sdk/client";
import { classifyApiWrite, operationSubject, type WorkbenchOperations } from "@pstdio/workbench";
import { WORKBENCH_SETTINGS_OPEN_COMMAND_ID } from "@pstdio/workbench/react";

const issueDomain = "machine-token.issue";
const revokeDomain = "machine-token.revoke";
const sourceCommand = { id: WORKBENCH_SETTINGS_OPEN_COMMAND_ID, args: { panelId: "machine-tokens" } };

export const createMachineTokenOperations = (
  operations: WorkbenchOperations,
  api: Pick<AutomationClient, "issueToken" | "listTokens" | "revokeToken">,
) => {
  const project = (projectId: string) => {
    const { pending, recovery } = operations.getSnapshot();
    const unresolved = recovery.find(
      (entry) => entry.projectId === projectId && entry.domain === issueDomain && entry.status === "unknown",
    );
    const revocations = pending.filter((entry) => entry.projectId === projectId && entry.domain === revokeDomain);
    return {
      issuing: pending.some(
        (entry) => entry.projectId === projectId && entry.domain === issueDomain && entry.status !== "unknown",
      ),
      unresolved: Boolean(unresolved),
      draft: unresolved?.draft as IssueAutomationTokenInput | undefined,
      revokingIds: new Set(revocations.flatMap(({ intent }) => (typeof intent === "string" ? [intent] : []))),
      revoking: revocations.some((entry) => entry.status !== "unknown" && entry.status !== "unconfirmed"),
    };
  };
  return {
    project,
    snapshot: operations.getSnapshot,
    subscribe: operations.subscribe,
    async issue(input: IssueAutomationTokenInput) {
      const current = project(input.projectId);
      if (current.issuing) throw new Error("Token issuance is already in progress.");
      if (current.unresolved) throw new Error("Review active tokens before issuing another token.");
      return operations.submit({
        domain: issueDomain,
        projectId: input.projectId,
        subjects: [operationSubject("machine-token", input.projectId, "issue")],
        sourceCommand,
        title: "Issue machine token",
        draft: input,
        releaseOnDiscard: true,
        classify: classifyApiWrite,
        write: (signal) => api.issueToken(input, { signal }),
      }).result;
    },
    async revoke(projectId: string, tokenId: string, accept: (result: ListAutomationTokensResponse) => void) {
      if (project(projectId).revokingIds.has(tokenId)) throw new Error("This token is already being revoked.");
      const read = (signal: AbortSignal) => api.listTokens(projectId, { signal });
      const revoked = (result: ListAutomationTokensResponse) =>
        result.tokens.some((token) => token.id === tokenId && token.revokedAt);
      return operations.submit({
        domain: revokeDomain,
        projectId,
        subjects: [operationSubject("machine-token", projectId, tokenId)],
        sourceCommand,
        title: "Revoke machine token",
        intent: tokenId,
        draft: { tokenId },
        releaseOnDiscard: true,
        classify: classifyApiWrite,
        write: (signal) => api.revokeToken(tokenId, { signal }),
        async reconcile(_saved, signal) {
          const latest = await read(signal);
          signal.throwIfAborted();
          if (!revoked(latest) && latest.tokens.some((token) => token.id === tokenId)) {
            throw new Error("The token list is still refreshing.");
          }
          accept(latest);
        },
        async check(signal) {
          const latest = await read(signal);
          return revoked(latest) ? { status: "confirmed", result: undefined } : { status: "unknown" };
        },
      }).result;
    },
  };
};
