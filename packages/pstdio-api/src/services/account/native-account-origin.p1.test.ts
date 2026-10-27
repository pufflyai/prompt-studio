import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import { createClient } from "@pstdio/sdk/client";
import { createAccountRoutes } from "../../features/account/routes";
import { createNativeAccount } from "./native-account";

test.each([
  {
    name: "hosted default",
    environment: undefined,
    explicit: undefined,
    expected: "https://base.prompt.studio/accounts",
  },
  {
    name: "host environment",
    environment: "https://dev.example.test/accounts/",
    explicit: undefined,
    expected: "https://dev.example.test/accounts",
  },
  {
    name: "explicit service",
    environment: "https://dev.example.test/accounts",
    explicit: "https://self.example.test/auth/",
    expected: "https://self.example.test/auth",
  },
  {
    name: "explicit service over invalid environment",
    environment: "invalid",
    explicit: "https://self.example.test",
    expected: "https://self.example.test",
  },
])("native login uses $name through the public client", async ({ environment, explicit, expected }) => {
  const previous = process.env.PSTDIO_ACCOUNT_MANAGER_ORIGIN;
  if (environment === undefined) delete process.env.PSTDIO_ACCOUNT_MANAGER_ORIGIN;
  else process.env.PSTDIO_ACCOUNT_MANAGER_ORIGIN = environment;
  const root = await mkdtemp(join(tmpdir(), "native-account-origin-"));
  const account = createNativeAccount({
    file: join(root, "native-account.json"),
    environment: { get: async () => ({ environmentId: "device" }) },
    projects: {
      get: async () => {
        throw new Error("Signing in reads no project");
      },
    },
  });
  const app = new OpenAPIHono().route("/v1", createAccountRoutes(account));
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: app.fetch });
  try {
    const client = createClient({ baseUrl: server.url.origin });
    const login = await client.account.login(explicit);
    const url = new URL(login.url);
    expect(`${url.origin}${url.pathname}`).toBe(`${expected}/v1/native-login`);
    expect(await client.account.loginStatus(login.id)).toEqual({ status: "pending" });
    await client.account.cancelLogin(login.id);
    expect(await client.account.loginStatus(login.id)).toEqual({ status: "failed" });
  } finally {
    await account.close();
    await server.stop(true);
    await rm(root, { recursive: true, force: true });
    if (previous === undefined) delete process.env.PSTDIO_ACCOUNT_MANAGER_ORIGIN;
    else process.env.PSTDIO_ACCOUNT_MANAGER_ORIGIN = previous;
  }
});

test("native login rejects an invalid configured service instead of using the hosted default", async () => {
  const previous = process.env.PSTDIO_ACCOUNT_MANAGER_ORIGIN;
  process.env.PSTDIO_ACCOUNT_MANAGER_ORIGIN = "http://accounts.example.test";
  const root = await mkdtemp(join(tmpdir(), "native-account-origin-"));
  const account = createNativeAccount({
    file: join(root, "native-account.json"),
    environment: { get: async () => ({ environmentId: "device" }) },
    projects: {
      get: async () => {
        throw new Error("Signing in reads no project");
      },
    },
  });
  try {
    await expect(account.login()).rejects.toThrow("https");
  } finally {
    await account.close();
    await rm(root, { recursive: true, force: true });
    if (previous === undefined) delete process.env.PSTDIO_ACCOUNT_MANAGER_ORIGIN;
    else process.env.PSTDIO_ACCOUNT_MANAGER_ORIGIN = previous;
  }
});
