import type {
  AutomationRun,
  CreateAutomationRunInput,
  IssueAutomationTokenInput,
  IssueAutomationTokenResponse,
  ListAutomationRunEventsResponse,
  ListAutomationTokensResponse,
} from "pstdio-api-contracts";
import type { RequestFn } from "./request";

export type AutomationClient = {
  issueToken(
    input: IssueAutomationTokenInput,
    options?: { signal?: AbortSignal },
  ): Promise<IssueAutomationTokenResponse>;
  listTokens(projectId: string, options?: { signal?: AbortSignal }): Promise<ListAutomationTokensResponse>;
  revokeToken(tokenId: string, options?: { signal?: AbortSignal }): Promise<void>;
  createRun(projectId: string, idempotencyKey: string, input: CreateAutomationRunInput): Promise<AutomationRun>;
  getRun(projectId: string, runId: string): Promise<AutomationRun>;
  listRunEvents(projectId: string, runId: string, after?: number): Promise<ListAutomationRunEventsResponse>;
  cancelRun(projectId: string, runId: string): Promise<AutomationRun>;
};

export const createAutomationClient = (request: RequestFn): AutomationClient => ({
  issueToken: (body, options) => request("/v1/auth/tokens", { method: "POST", body, signal: options?.signal }),
  listTokens: (projectId, options) =>
    request(`/v1/auth/tokens?projectId=${encodeURIComponent(projectId)}`, { signal: options?.signal }),
  revokeToken: (tokenId, options) =>
    request(`/v1/auth/tokens/${encodeURIComponent(tokenId)}`, { method: "DELETE", signal: options?.signal }),
  createRun: (projectId, idempotencyKey, body) =>
    request(`/v1/projects/${projectId}/automation-runs`, {
      method: "POST",
      headers: { "idempotency-key": idempotencyKey },
      body,
    }),
  getRun: (projectId, runId) => request(`/v1/projects/${projectId}/automation-runs/${encodeURIComponent(runId)}`),
  listRunEvents: (projectId, runId, after = 0) =>
    request(
      `/v1/projects/${projectId}/automation-runs/${encodeURIComponent(runId)}/events?after=${encodeURIComponent(after)}`,
    ),
  cancelRun: (projectId, runId) =>
    request(`/v1/projects/${projectId}/automation-runs/${encodeURIComponent(runId)}/cancel`, { method: "POST" }),
});
