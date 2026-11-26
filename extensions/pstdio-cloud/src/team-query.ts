import { accountEvents, type DeviceLogin, type TeamMembershipRead } from "@pstdio/sdk/extensions";
import { useWebviewQuery, useWebviewVisibility } from "@pstdio/sdk/extensions/react";
import { useCloudContext } from "./cloud-context";

export const useTeamQuery = <Request extends TeamMembershipRead>(
  request: Request,
  login: DeviceLogin,
  active = true,
) => {
  const { client } = useCloudContext();
  const visible = useWebviewVisibility();
  return useWebviewQuery(
    client.queries,
    {
      id: "cloud.team-membership",
      scope: { projectId: undefined, accountId: login.accountId, accountOrigin: login.managerOrigin },
      params: request,
      events: [accountEvents.changed],
      read: () =>
        client.account.readTeamMembership(request, {
          accountId: login.accountId,
          managerOrigin: login.managerOrigin,
        }),
    },
    visible && active,
  );
};
