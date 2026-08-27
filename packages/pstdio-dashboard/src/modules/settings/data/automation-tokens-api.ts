import type {
  IssueAutomationTokenInput,
  IssueAutomationTokenResponse,
  ListAutomationTokensResponse,
} from "@pstdio/sdk/api";
import { apiRequest } from "@/lib/api";

export const listAutomationTokens = (projectId: string) =>
  apiRequest<ListAutomationTokensResponse>(`/v1/auth/tokens?projectId=${encodeURIComponent(projectId)}`);

export const issueAutomationToken = (input: IssueAutomationTokenInput) =>
  apiRequest<IssueAutomationTokenResponse>("/v1/auth/tokens", { method: "POST", body: input });

export const revokeAutomationToken = (tokenId: string) =>
  apiRequest<void>(`/v1/auth/tokens/${encodeURIComponent(tokenId)}`, { method: "DELETE" });
