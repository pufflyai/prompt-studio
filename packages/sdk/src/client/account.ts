import type { RequestFn } from "./request";

export interface WorkbenchEnrollment {
  accountId: string;
  workbenchId: string;
  environmentId: string;
  managerOrigin: string;
  relayOrigin: string;
}
export interface AccountSession {
  user: { id: string; email: string; name: string };
  session: { expiresAt: string };
  accounts: { accountId: string }[];
  connections: WorkbenchEnrollment[];
}
export interface OwnerEnvironment {
  id: string;
  accountId: string;
  workbenchId: string;
  environmentId: string;
  expiresAt: string;
  revokedAt: string | null;
}
export const createAccountClient = (request: RequestFn) => {
  const query = (managerOrigin: string) => `?${new URLSearchParams({ managerOrigin })}`;
  const account = (accountId: string) => `/v1/account/accounts/${encodeURIComponent(accountId)}`;
  return {
    login: (managerOrigin: string) =>
      request<{ id: string; url: string }>("/v1/account/login", { method: "POST", body: { managerOrigin } }),
    loginStatus: (id: string) =>
      request<{ status: "pending" | "complete" | "failed" }>(`/v1/account/login/${encodeURIComponent(id)}`),
    inspect: (managerOrigin: string) => request<AccountSession>(`/v1/account${query(managerOrigin)}`),
    signOut: (managerOrigin: string) =>
      request<{ ok: boolean }>("/v1/account/sign-out", { method: "POST", body: { managerOrigin } }),
    create: (managerOrigin: string) =>
      request<{ accountId: string }>("/v1/account/accounts", { method: "POST", body: { managerOrigin } }),
    workbenches: (managerOrigin: string, accountId: string) =>
      request<{ workbenchId: string }[]>(`${account(accountId)}/workbenches${query(managerOrigin)}`),
    environments: (managerOrigin: string, accountId: string) =>
      request<OwnerEnvironment[]>(`${account(accountId)}/environments${query(managerOrigin)}`),
    revoke: (managerOrigin: string, accountId: string, environmentId: string) =>
      request<{ ok: boolean }>(`${account(accountId)}/environments/${encodeURIComponent(environmentId)}/revoke`, {
        method: "POST",
        body: { managerOrigin },
      }),
    connections: () => request<WorkbenchEnrollment[]>("/v1/account/connections"),
    connect: (workbenchId: string, input: { managerOrigin: string; accountId: string; expiresAt: string }) =>
      request<{ accountId: string; workbenchId: string; environmentId: string; connected: boolean }>(
        `/v1/projects/${encodeURIComponent(workbenchId)}/enrollment`,
        { method: "PUT", body: input },
      ),
  };
};
export type AccountClient = ReturnType<typeof createAccountClient>;
