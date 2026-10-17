import type { IssueAutomationTokenInput } from "@pstdio/sdk/api";
import { getApiClient } from "@/lib/api";

export const listAutomationTokens = (projectId: string) => getApiClient().automation.listTokens(projectId);

export const issueAutomationToken = (input: IssueAutomationTokenInput) => getApiClient().automation.issueToken(input);

export const revokeAutomationToken = (tokenId: string) => getApiClient().automation.revokeToken(tokenId);
