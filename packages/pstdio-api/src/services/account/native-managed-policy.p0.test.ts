import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ManagerRequestDenied } from "./manager-client";
import { createNativeManagedExtensions } from "./native-managed-extensions";
import type { DeviceLogin } from "./native-store";

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
  let fetchPolicy: () => Promise<unknown> = async () => policy;
  const file = join(root, "account.json");
  const service = createNativeManagedExtensions({
    file,
    current: async () => login,
    readLogin: async () => login,
    copies: {
      teamProjects: async () => [{ projectId: "project", accountId: "team", managerOrigin: initial.managerOrigin }],
    },
    call: async () => fetchPolicy(),
    signal: new AbortController().signal,
    refresh: async () => {},
    retryProject: async () => {},
  });
  return {
    service,
    file,
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

test("a policy response from a previous login cannot become the current user's policy", async () => {
  const f = await fixture();
  f.respond(async () => {
    f.signIn({ ...initial, accountId: "different-member", token: "different-credential" });
    return policy;
  });
  await expect(f.service.projectPolicy("project")).rejects.toThrow("The signed-in account changed");
  expect(await Bun.file(`${f.file}.managed-extensions.json`).exists()).toBe(false);
});
