import { serviceUrl } from "pstdio-sync/relay";
import {
  createdTeamInvitationSchema,
  joinedTeamSchema,
  type TeamMembershipRead,
  type TeamMembershipReadResult,
  type TeamMembershipWrite,
  type TeamMembershipWriteResult,
  teamInvitationSchema,
  teamInvitationViewSchema,
  teamInviteSecretSchema,
  teamMemberSchema,
  teamOwnershipOfferSchema,
  teamProjectAccessSchema,
} from "pstdio-sync-contracts";
import { z } from "zod";
import { ManagerRequestDenied } from "./manager-client";
import { AccountRequestError } from "./native-account";
import { type DeviceReadIdentity, matchesDeviceAccount } from "./native-device-read";
import type { createNativeManagerCall } from "./native-manager-call";
import type { DeviceLogin } from "./native-store";

const teamPath = (id: string) => `/v1/teams/${encodeURIComponent(id)}`;

const invitationSecret = (link: string, managerOrigin: string) => {
  const url = new URL(link);
  const expected = new URL(serviceUrl(managerOrigin, "/v1/team-invitation"));
  const secret = teamInviteSecretSchema.safeParse(url.hash.slice(1));
  if (
    url.origin !== expected.origin ||
    url.pathname !== expected.pathname ||
    url.username ||
    url.password ||
    url.search ||
    !secret.success
  )
    throw new AccountRequestError("Enter an invitation link from the signed-in Cloud service");
  return secret.data;
};

const ok = z.strictObject({ ok: z.literal(true) });

export const createNativeTeamMembership = (input: {
  current: () => Promise<DeviceLogin>;
  call: ReturnType<typeof createNativeManagerCall>;
  refresh: () => Promise<void>;
  localProjectNames: (managerOrigin: string, accountId: string) => Promise<Map<string, string>>;
}) => {
  const assertCurrent = async (previous: DeviceLogin) => {
    const login = await input.current();
    if (!matchesDeviceAccount(login, previous) || login.token !== previous.token)
      throw new AccountRequestError("The signed-in account changed");
  };

  const withLogin = async <Result>(
    expected: DeviceReadIdentity | undefined,
    run: (login: DeviceLogin, call: (path: string, body?: unknown) => Promise<unknown>) => Promise<Result>,
    signal?: AbortSignal,
    refresh = false,
  ) => {
    const login = await input.current();
    if (expected && !matchesDeviceAccount(login, expected))
      throw new AccountRequestError("The signed-in account changed");
    const call = (path: string, body?: unknown) =>
      input.call(path, body, login.token, signal, login, true).catch((error) => {
        if (error instanceof ManagerRequestDenied && error.status === 403)
          throw new AccountRequestError("This team action is unavailable to the signed-in account");
        throw error;
      });
    const result = await run(login, call);
    if (refresh) await input.refresh();
    await assertCurrent(login);
    return result;
  };

  return {
    read: <Request extends TeamMembershipRead>(request: Request, expected?: DeviceReadIdentity, signal?: AbortSignal) =>
      withLogin(
        expected,
        async (login, call) => {
          switch (request.op) {
            case "members":
              return z.array(teamMemberSchema).parse(await call(`${teamPath(request.accountId)}/members`));
            case "invitations":
              return z.array(teamInvitationSchema).parse(await call(`${teamPath(request.accountId)}/invitations`));
            case "projectAccess": {
              const access = z
                .array(teamProjectAccessSchema)
                .parse(await call(`${teamPath(request.accountId)}/projects`));
              const names = await input.localProjectNames(login.managerOrigin, request.accountId);
              return access.map(({ workbenchId, userIds }) => ({ workbenchId, name: names.get(workbenchId), userIds }));
            }
            case "ownershipOffer":
              return teamOwnershipOfferSchema.nullable().parse(await call(`${teamPath(request.accountId)}/ownership`));
            case "inspectInvitation":
              return teamInvitationViewSchema.parse(
                await call("/v1/team-invitations/inspect", {
                  secret: invitationSecret(request.url, login.managerOrigin),
                }),
              );
          }
        },
        signal,
      ) as Promise<TeamMembershipReadResult<Request>>,
    write: async <Request extends TeamMembershipWrite>(request: Request, expected?: DeviceReadIdentity) => {
      const result = await withLogin(
        expected,
        async (login, call) => {
          switch (request.op) {
            case "invite":
              return createdTeamInvitationSchema.parse(
                await call(`${teamPath(request.accountId)}/invitations`, {
                  email: request.email,
                  microsoft: request.microsoft,
                }),
              );
            case "cancelInvitation":
              return ok.parse(
                await call(
                  `${teamPath(request.accountId)}/invitations/${encodeURIComponent(request.invitationId)}/cancel`,
                  {},
                ),
              );
            case "removeMember":
              return ok.parse(
                await call(`${teamPath(request.accountId)}/members/${encodeURIComponent(request.userId)}/remove`, {}),
              );
            case "setProjectAccess":
              return ok.parse(
                await call(
                  `${teamPath(request.accountId)}/projects/${encodeURIComponent(request.workbenchId)}/access`,
                  {
                    userId: request.userId,
                    granted: request.granted,
                  },
                ),
              );
            case "leave":
              return ok.parse(await call(`${teamPath(request.accountId)}/leave`, {}));
            case "offerOwnership":
              return teamOwnershipOfferSchema.parse(
                await call(`${teamPath(request.accountId)}/ownership`, { recipientUserId: request.recipientUserId }),
              );
            case "answerOwnership":
              return ok.parse(
                await call(`${teamPath(request.accountId)}/ownership/${encodeURIComponent(request.offerId)}`, {
                  decision: request.decision,
                }),
              );
            case "acceptInvitation":
              return joinedTeamSchema.parse(
                await call("/v1/team-invitations/accept", {
                  secret: invitationSecret(request.url, login.managerOrigin),
                }),
              );
          }
        },
        undefined,
        true,
      );
      return result as TeamMembershipWriteResult<Request>;
    },
  };
};
