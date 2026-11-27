import { type APIRequestContext, expect, type Page } from "@playwright/test";
import type {
  AccountStatus,
  TeamAccount,
  TeamExtensionPolicy,
  TeamInvitationView,
  TeamMember,
  TeamMembershipWrite,
  TeamOwnershipOffer,
} from "@pstdio/sdk/extensions";
import { folderProjectInput } from "../../helpers/folder-project";

interface TeamSettingsFixtureOptions {
  role?: "owner" | "member";
  hasTeam?: boolean;
  required?: boolean;
  ownership?: TeamOwnershipOffer;
  inspect?: (code: string) => Promise<TeamInvitationView>;
}

/** Browser/bridge fixture only. Manager authority and automatic installation have separate service/native qualification. */
export const teamSettingsFixture = async (
  page: Page,
  request: APIRequestContext,
  options: TeamSettingsFixtureOptions = {},
) => {
  const response = await request.post("/v1/projects", { data: folderProjectInput({ name: "Team settings journey" }) });
  expect(response.ok()).toBe(true);
  const { id: projectId } = await response.json();
  const role = options.role ?? "owner";
  const expected = { accountId: role === "owner" ? "alex" : "riley", managerOrigin: "https://accounts.example.test" };
  const team: TeamAccount = { accountId: "studio", name: "Studio Team", role, features: { relay: true } };
  const account: AccountStatus = {
    login: {
      ...expected,
      deviceId: "fixture-device",
      relayOrigin: "https://relay.example.test",
      email: `${expected.accountId}@example.test`,
    },
    cloudProjects: options.hasTeam === false ? [] : [projectId],
    cloudProjectsLoaded: true,
    features: { relay: true },
    teamAccounts: options.hasTeam === false ? [] : [team],
    teamProjects: options.hasTeam === false ? {} : { [projectId]: team.accountId },
    teamProjectOwners: options.hasTeam === false ? {} : { [projectId]: team.accountId },
  };
  const members: TeamMember[] = [
    { userId: "alex", name: "Alex Morgan", role: "owner" },
    { userId: "riley", name: "Riley Chen", role: "member" },
  ];
  const writes: TeamMembershipWrite[] = [];
  const grants = ["alex", "riley"];
  let offer: TeamOwnershipOffer | null = options.ownership ?? null;
  let codes: { id: string; expiresAt: string }[] = [];
  const descriptor = {
    extensionId: "pstdio.cloud",
    name: "Prompt Studio Cloud",
    version: "0.3.0",
    revision: "a".repeat(64),
    selectionId: "managed-selection",
  };
  let policy: TeamExtensionPolicy[] = options.required
    ? [{ extensionId: descriptor.extensionId, selectionId: descriptor.selectionId, required: descriptor }]
    : [];
  let syncState = "synced";
  await page.route("**/v1/account", (route) => route.fulfill({ json: account }));
  await page.route("**/v1/account/devices*", (route) => route.fulfill({ json: [] }));
  await page.route(`**/v1/account/projects/${projectId}/sync*`, (route) => {
    if (route.request().method() === "DELETE") syncState = "local";
    return route.fulfill({ json: { state: syncState, offlineReady: false } });
  });
  await page.route("**/v1/account/teams", (route) => {
    const body = route.request().postDataJSON();
    expect(body.expected).toEqual(expected);
    const created = { ...team, accountId: "created-team", name: body.name, features: { relay: false } };
    account.teamAccounts?.push(created);
    return route.fulfill({ json: created });
  });
  await page.route("**/v1/account/team-membership/read", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.expected).toEqual(expected);
    const input = body.request;
    let result: unknown;
    switch (input.op) {
      case "members":
        result = members;
        break;
      case "inviteCodes":
        result = codes;
        break;
      case "ownershipOffer":
        result = offer;
        break;
      case "extensionPolicy":
        result = policy;
        break;
      case "projectAccess":
        result = [{ workbenchId: projectId, userIds: grants }];
        break;
      case "inspectInviteCode":
        expect(route.request().url()).not.toContain(input.code);
        result = options.inspect
          ? await options.inspect(input.code)
          : { state: "pending", teamName: team.name, signedInEmail: account.login?.email };
        break;
      default:
        throw new Error(`Unexpected membership read: ${input.op}`);
    }
    await route.fulfill({ json: result });
  });
  await page.route("**/v1/account/team-membership/write", (route) => {
    const body = route.request().postDataJSON();
    expect(body.expected).toEqual(expected);
    const input: TeamMembershipWrite = body.request;
    writes.push(input);
    let result: unknown = { ok: true };
    switch (input.op) {
      case "inviteCode": {
        const invitation = { id: "desktop-invite", expiresAt: new Date(Date.now() + 86_400_000).toISOString() };
        codes.push(invitation);
        result = { ...invitation, code: "c".repeat(43) };
        break;
      }
      case "cancelInvitation":
        codes = codes.filter(({ id }) => id !== input.invitationId);
        break;
      case "removeMember": {
        const index = members.findIndex(({ userId }) => userId === input.userId);
        if (index >= 0) members.splice(index, 1);
        break;
      }
      case "manageExtension":
        expect(input.projectId).toBe(projectId);
        expect(input.instanceId).toBeTruthy();
        policy = [{ extensionId: descriptor.extensionId, selectionId: descriptor.selectionId, required: descriptor }];
        result = descriptor;
        break;
      case "unmanageExtension":
        expect(input.extensionId).toBe(descriptor.extensionId);
        policy = [{ extensionId: descriptor.extensionId, selectionId: "released-selection", required: null }];
        break;
      case "setProjectAccess": {
        expect(input.workbenchId).toBe(projectId);
        const index = grants.indexOf(input.userId);
        if (input.granted && index < 0) grants.push(input.userId);
        if (!input.granted && index >= 0) grants.splice(index, 1);
        break;
      }
      case "acceptInviteCode":
        account.teamAccounts = [team];
        result = { state: "joined", accountId: team.accountId };
        break;
      case "answerOwnership":
        expect(input.offerId).toBe(offer?.id);
        team.role = "owner";
        offer = null;
        break;
      default:
        throw new Error(`Unexpected membership write: ${input.op}`);
    }
    return route.fulfill({ json: result });
  });
  await page.addInitScript(() => {
    if (window === window.top) localStorage.setItem("onboarding-complete", "true");
  });
  await page.goto(`/projects/${projectId}/`);
  await page.locator("footer").getByRole("button", { name: "Prompt Studio Cloud", exact: true }).click();
  await page.frameLocator('iframe[title="Cloud details"]').getByRole("button", { name: "Cloud settings" }).click();
  const open = async (name: "Team" | "Managed extensions") => {
    await page.getByRole("option", { name, exact: true }).click();
    return page.frameLocator(`iframe[title="${name}"]`);
  };
  return { projectId, expected, team, account, members, writes, open };
};
