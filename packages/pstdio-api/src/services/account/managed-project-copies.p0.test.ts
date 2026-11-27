import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createManagedProjectCopies } from "./managed-project-copies";
import type { DeviceLogin } from "./native-store";
import { createProjectCopyStore } from "./project-copy-store";

test("automatic team tools target only the current principal's admitted local copies", async () => {
  const root = await mkdtemp(join(tmpdir(), "managed-project-copies-"));
  try {
    const initial: DeviceLogin = {
      managerOrigin: "https://manager.fixture.test",
      relayOrigin: "https://relay.fixture.test",
      accountId: "member",
      deviceId: "device",
      token: "private-device-credential",
    };
    let login: DeviceLogin | null = initial;
    const copies = createProjectCopyStore(join(root, "account.json"));
    const admission = {
      managerOrigin: initial.managerOrigin,
      accountId: "team",
      userId: initial.accountId,
      deviceId: initial.deviceId,
      grantId: "initial-grant",
    };
    const ids = ["available", "revoked", "absent", "removing", "different-owner"];
    for (const projectId of ids)
      await copies.bindTeamProject(
        { managerOrigin: initial.managerOrigin, accountId: "team", projectId },
        async () => true,
      );
    await copies.rememberTeamAdmissions(
      ids.filter((projectId) => projectId !== "different-owner").map((projectId) => ({ ...admission, projectId })),
    );
    await copies.rememberTeamAdmissions([{ ...admission, projectId: "different-owner", accountId: "other-team" }]);
    await copies.recordTeamAdmissionAccess(initial, "revoked", null);
    const { managerOrigin, accountId, userId, deviceId } = admission;
    await copies.write({
      managerOrigin,
      accountId,
      userId,
      deviceId,
      projectId: "removing",
      name: "Removing",
      phase: "removing",
    });
    const read = createManagedProjectCopies({
      copies,
      login: async () => login,
      exists: async (id) => id !== "absent",
    });
    const available = await read();
    expect(available.map(({ projectId }) => projectId)).toEqual(["available"]);
    expect(JSON.stringify(available)).not.toContain(initial.token);
    await copies.rememberTeamAdmissions([{ ...admission, projectId: "available", grantId: "returned-grant" }]);
    expect((await read())[0]?.scope).not.toBe(available[0]!.scope);
    login = { ...initial, accountId: "another-member" };
    expect(await read()).toEqual([]);
    login = { ...initial, deviceId: "another-device" };
    expect(await read()).toEqual([]);
    login = null;
    expect(await read()).toEqual([]);
    login = initial;
    const switched = createManagedProjectCopies({
      copies,
      login: async () => login,
      exists: async () => {
        login = null;
        return true;
      },
    });
    expect(await switched()).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
