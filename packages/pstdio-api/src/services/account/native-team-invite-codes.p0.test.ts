import { expect, test } from "bun:test";
import type { DeviceLogin } from "./native-store";
import { createNativeTeamMembership } from "./native-team-membership";

const initial: DeviceLogin = {
  managerOrigin: "https://manager.fixture.test/accounts",
  relayOrigin: "https://relay.fixture.test",
  accountId: "owner",
  deviceId: "owner-device",
  token: "device-credential-fixture-only",
};
const code = "x".repeat(43);
const metadata = { id: "invitation", expiresAt: "2026-12-01T12:00:00.000Z" };

test("desktop code operations stay on the signed-in manager and refresh membership after acceptance", async () => {
  const calls: { path: string; body?: unknown }[] = [];
  let refreshes = 0;
  const membership = createNativeTeamMembership({
    current: async () => initial,
    refresh: async () => {
      refreshes += 1;
    },
    localProjectNames: async () => new Map(),
    call: async (path, body) => {
      calls.push({ path, body });
      if (path.endsWith("/invite-codes")) return body ? { ...metadata, code } : [metadata];
      if (path.endsWith("/inspect")) return { state: "pending", teamName: "Studio Team" };
      return { state: "joined", accountId: "team" };
    },
  });
  expect(await membership.write({ op: "inviteCode", accountId: "team/one" }, initial)).toEqual({ ...metadata, code });
  expect(await membership.read({ op: "inviteCodes", accountId: "team/one" }, initial)).toEqual([metadata]);
  expect(await membership.read({ op: "inspectInviteCode", code }, initial)).toEqual({
    state: "pending",
    teamName: "Studio Team",
  });
  expect(await membership.write({ op: "acceptInviteCode", code }, initial)).toEqual({
    state: "joined",
    accountId: "team",
  });
  expect(calls).toEqual([
    { path: "/v1/teams/team%2Fone/invite-codes", body: {} },
    { path: "/v1/teams/team%2Fone/invite-codes", body: undefined },
    { path: "/v1/team-invitations/inspect", body: { secret: code } },
    { path: "/v1/team-invitations/accept", body: { secret: code } },
  ]);
  expect(calls.every(({ path }) => !path.includes(code))).toBe(true);
  expect(refreshes).toBe(2);
});

test("a code created during a sign-in change is not returned to the new account", async () => {
  let login = initial;
  const membership = createNativeTeamMembership({
    current: async () => login,
    refresh: async () => {},
    localProjectNames: async () => new Map(),
    call: async () => {
      login = { ...initial, accountId: "other-person", token: "other-device-credential" };
      return { ...metadata, code };
    },
  });
  await expect(membership.write({ op: "inviteCode", accountId: "team" }, initial)).rejects.toThrow(
    "The signed-in account changed",
  );
});
