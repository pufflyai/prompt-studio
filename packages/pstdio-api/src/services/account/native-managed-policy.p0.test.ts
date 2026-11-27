import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ManagerRequestDenied } from "./manager-client";
import { createNativeManagedExtensions } from "./native-managed-extensions";
import type { DeviceLogin } from "./native-store";
import { createProjectCopyStore } from "./project-copy-store";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
const initial: DeviceLogin = {
  managerOrigin: "https://manager.fixture.test/accounts",
  relayOrigin: "https://relay.fixture.test",
  accountId: "member",
  deviceId: "member-device",
  token: "fixture-device-credential",
};
const policy = [
  {
    extensionId: "fixture.tools",
    selectionId: "decision-1",
    required: {
      extensionId: "fixture.tools",
      name: "Tools",
      version: "1.0.0",
      revision: "a".repeat(64),
      selectionId: "decision-1",
    },
  },
];
const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "native-managed-policy-"));
  roots.push(root);
  let login = initial;
  let granted = true;
  let unreachable = false;
  let grantId = "grant";
  let afterIdentityRead = () => {};
  let fetchPolicy: () => Promise<unknown> = async () => policy;
  const file = join(root, "account.json");
  const copies = createProjectCopyStore(file);
  const admission = {
    projectId: "project",
    accountId: "team",
    managerOrigin: initial.managerOrigin,
    userId: initial.accountId,
    deviceId: initial.deviceId,
    grantId,
  };
  await copies.bindTeamProject(
    { projectId: admission.projectId, accountId: admission.accountId, managerOrigin: admission.managerOrigin },
    async () => true,
  );
  await copies.rememberTeamAdmissions([admission]);
  const createService = () =>
    createNativeManagedExtensions({
      file,
      current: async () => login,
      readLogin: async () => {
        const snapshot = login;
        afterIdentityRead();
        return snapshot;
      },
      copies,
      call: async (path) => {
        if (unreachable) throw new TypeError("Network unavailable");
        if (path.startsWith("/v1/workbenches")) return granted ? [{ workbenchId: "project", grantId }] : [];
        return fetchPolicy();
      },
      signal: new AbortController().signal,
      refresh: async () => {},
      retryProject: async () => {},
    });
  let service = createService();
  return {
    get service() {
      return service;
    },
    file,
    restart: () => {
      service = createService();
    },
    offline: () => {
      unreachable = true;
    },
    restoreProject: async () => {
      granted = true;
      unreachable = false;
      grantId = "new-grant";
      await copies.rememberTeamAdmissions([{ ...admission, grantId }]);
    },
    revokeProject: () => {
      granted = false;
    },
    replaceGrantWithoutAdmission: () => {
      grantId = "new-grant";
    },
    afterNextIdentityRead: (run: () => void) => {
      afterIdentityRead = () => {
        afterIdentityRead = () => {};
        run();
      };
    },
    signIn: (next: DeviceLogin) => {
      login = next;
    },
    respond: (next: typeof fetchPolicy) => {
      fetchPolicy = next;
    },
  };
};

test("known team policy works offline but access denial never falls back to cached authority", async () => {
  const f = await fixture();
  expect(await f.service.projectPolicy("project")).toEqual(policy);
  f.respond(async () => {
    throw new TypeError("Network unavailable");
  });
  expect(await f.service.required("project", "fixture.tools")).toBe(true);
  const saved = await Bun.file(`${f.file}.managed-extensions.json`).text();
  expect(saved).not.toContain(initial.token);
  expect(saved).not.toContain("MICROSOFT_CLIENT_SECRET");
  for (const status of [401, 403]) {
    f.respond(async () => {
      throw new ManagerRequestDenied(status);
    });
    await expect(f.service.projectPolicy("project")).rejects.toBeInstanceOf(ManagerRequestDenied);
  }
});

test("team membership alone cannot activate cached packages after project access is revoked", async () => {
  const f = await fixture();
  await f.service.projectPolicy("project");
  f.revokeProject();
  await expect(f.service.required("project", "fixture.tools")).rejects.toThrow("Current project access");
  f.restart();
  f.offline();
  await expect(f.service.cachedProjectPolicy("project")).rejects.toThrow("Connect to Cloud");
  await expect(f.service.required("project", "fixture.tools")).rejects.toThrow("Connect to Cloud");
  await f.restoreProject();
  expect(await f.service.required("project", "fixture.tools")).toBe(true);
  f.offline();
  expect(await f.service.required("project", "fixture.tools")).toBe(true);
});

test("data writes use the admitted native policy snapshot without a manager round trip", async () => {
  const f = await fixture();
  await f.service.projectPolicy("project");
  let requests = 0;
  f.respond(async () => {
    requests++;
    throw new TypeError("Data writes should use the refreshed native policy");
  });
  expect(await f.service.cachedProjectPolicy("project")).toEqual(policy);
  expect(await f.service.cachedProjectPolicy("project")).toEqual(policy);
  expect(requests).toBe(0);
  f.signIn({ ...initial, accountId: "another-user", token: "another-credential" });
  await expect(f.service.cachedProjectPolicy("project")).rejects.toThrow("Connect to Cloud");
});

test("an unknown or different signed-in user cannot borrow another user's cached team policy", async () => {
  const f = await fixture();
  f.respond(async () => {
    throw new TypeError("Network unavailable");
  });
  await expect(f.service.projectPolicy("project")).rejects.toThrow("Connect to Cloud");
  expect(await f.service.projectPolicy("personal-project")).toEqual([]);
  f.respond(async () => policy);
  await f.service.projectPolicy("project");
  f.signIn({ ...initial, accountId: "different-member", token: "different-credential" });
  f.respond(async () => {
    throw new TypeError("Network unavailable");
  });
  await expect(f.service.projectPolicy("project")).rejects.toThrow("Connect to Cloud");
});

test("observing a new project grant blocks offline reuse until its normal sync admission completes", async () => {
  const f = await fixture();
  await f.service.projectPolicy("project");
  f.replaceGrantWithoutAdmission();
  f.respond(async () => {
    throw new TypeError("Policy fetch interrupted");
  });
  await expect(f.service.projectPolicy("project")).rejects.toThrow("Connect to Cloud");
  f.restart();
  f.offline();
  await expect(f.service.projectPolicy("project")).rejects.toThrow("Connect to Cloud");
  await f.restoreProject();
  f.respond(async () => policy);
  expect(await f.service.projectPolicy("project")).toEqual(policy);
});

test("a policy response from a previous login cannot become the current user's policy", async () => {
  const f = await fixture();
  f.respond(async () => {
    f.signIn({ ...initial, accountId: "different-member", token: "different-credential" });
    return policy;
  });
  await expect(f.service.projectPolicy("project")).rejects.toThrow("The signed-in account changed");
  expect(await Bun.file(`${f.file}.managed-extensions.json`).exists()).toBe(false);
});

test("an account change while reading an offline cache cannot return the previous account's policy", async () => {
  const f = await fixture();
  await f.service.projectPolicy("project");
  f.respond(async () => {
    throw new TypeError("Network unavailable");
  });
  f.afterNextIdentityRead(() => f.signIn({ ...initial, accountId: "different-member", token: "different-credential" }));
  await expect(f.service.projectPolicy("project")).rejects.toThrow("The signed-in account changed");
});
