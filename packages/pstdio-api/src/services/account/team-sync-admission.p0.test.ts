import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RelayWorkbench } from "../relay/runtime";
import { type CloudReturn, createNativeCloudReturn } from "./native-cloud-return";
import { createProjectCopyStore } from "./project-copy-store";
import { createTeamSyncAdmission } from "./team-sync-admission";

test("a changed team grant folds offline edits before reopening on a restarted device", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pstdio-team-admission-"));
  const file = join(dir, "account.json");
  const login = {
    accountId: "person",
    deviceId: "device",
    managerOrigin: "https://manager.fixture.test",
    relayOrigin: "https://relay.fixture.test",
    token: "fixture",
  };
  const team: RelayWorkbench = {
    ...login,
    userId: login.accountId,
    accountId: "team",
    environmentId: login.deviceId,
    renewalGrant: login.token,
    workbenchId: "project-a",
    grantId: "new-grant",
  };
  const personal = {
    ...team,
    workbenchId: "personal",
    accountId: login.accountId,
    userId: undefined,
    grantId: undefined,
  };
  const order: Array<[string, string[]]> = [];
  const returns = createNativeCloudReturn();
  returns.connect({
    async release(ids: string[]) {
      order.push(["return state", ids]);
    },
  } as CloudReturn);

  const update = async (connections: RelayWorkbench[]) => {
    order.push(["connections", connections.map(({ workbenchId }) => workbenchId)]);
  };
  try {
    await createProjectCopyStore(file).rememberTeamAdmissions([
      {
        accountId: team.accountId,
        projectId: team.workbenchId,
        userId: login.accountId,
        deviceId: login.deviceId,
        managerOrigin: login.managerOrigin,
        grantId: "old-grant",
      },
    ]);
    const stored = createProjectCopyStore(file);
    const admit = createTeamSyncAdmission(stored, returns);
    const projects = ["project-a", "personal"];
    await admit(login, [team, personal], projects, update);
    expect(order).toEqual([
      ["connections", ["personal"]],
      ["return state", ["personal"]],
      ["return state", ["project-a", "personal"]],
      ["connections", ["project-a", "personal"]],
    ]);
    expect(await stored.teamAdmissions(login)).toMatchObject([{ grantId: team.grantId }]);

    order.length = 0;
    await admit(login, [team, personal], projects, update);
    expect(order).toEqual([["connections", ["project-a", "personal"]]]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
