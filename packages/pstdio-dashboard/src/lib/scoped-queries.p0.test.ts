import { expect, test } from "bun:test";
import type { AccountStatus } from "@pstdio/sdk/client";
import { publishExtensionEvent, publishExtensionEventReset } from "@/shared/extensions/extension-webview-broadcast";
import { getDashboardAccountStatusQuery, getDashboardScopedQueries } from "./scoped-queries";
import { createRuntimeCollections } from "./sync/collections";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
const status = (accountId: string, managerOrigin = "https://first.example"): AccountStatus => ({
  login: { accountId, managerOrigin, relayOrigin: managerOrigin, deviceId: "device" },
  features: { relay: true },
  cloudProjects: ["a", "b"],
  cloudProjectsLoaded: true,
});

test("one runtime account reader revokes active and retained data before publishing a new account", async () => {
  let current = status("first");
  let reads = 0;
  const server = Bun.serve({
    port: 0,
    fetch: () => {
      reads++;
      return Response.json(current);
    },
  });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "" });
  try {
    const account = getDashboardAccountStatusQuery(owner);
    const root = getDashboardScopedQueries(owner);
    const first = account.subscribe(() => {});
    const second = account.subscribe(() => {});
    await account.read();
    expect(reads).toBe(1);
    const query = root.forScope({ projectId: "a" }).query({ id: "notes", read: async () => "private first" });
    const warm = root.forScope({ projectId: "b" }).query({ id: "notes", read: async () => "private warm" });
    const stop = query.subscribe(() => {});
    await Promise.all([query.read(), warm.read()]);
    current = status("second");
    publishExtensionEvent({ id: "account.changed" }, owner);
    await account.read();
    expect(reads).toBe(2);
    expect(query.isDisposed()).toBe(true);
    expect(warm.isDisposed()).toBe(true);
    expect(query.getSnapshot().data).toBeUndefined();
    expect(account.getSnapshot().data?.login?.accountId).toBe("second");
    const replacement = root.forScope({ projectId: "a" }).query({ id: "notes", read: async () => "second" });
    expect(replacement.key).toContain("second");
    current = status("second", "https://different.example");
    publishExtensionEventReset({}, owner);
    await account.read();
    expect(replacement.isDisposed()).toBe(true);
    const signedIn = root.forScope({ projectId: "a" }).query({ id: "notes", read: async () => "second" });
    current = { ...current, signInRequired: true };
    publishExtensionEvent({ id: "account.changed" }, owner);
    await account.read();
    expect(signedIn.isDisposed()).toBe(true);
    stop();
    first();
    second();
    await turn();
    expect(reads).toBe(4);
  } finally {
    await owner.dispose();
    await server.stop(true);
  }
});

test("another runtime's account signals do not reread identity and disposal stops observation", async () => {
  let reads = 0;
  const server = Bun.serve({
    port: 0,
    fetch: () => {
      reads++;
      return Response.json(status("first"));
    },
  });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "" });
  const other = createRuntimeCollections({ baseUrl: server.url.origin, token: "other" });
  try {
    await getDashboardAccountStatusQuery(owner).read();
    publishExtensionEvent({ id: "account.changed" }, other);
    await turn();
    expect(reads).toBe(1);
    await owner.dispose();
    publishExtensionEvent({ id: "account.changed" }, owner);
    await turn();
    expect(reads).toBe(1);
  } finally {
    await owner.dispose();
    await other.dispose();
    await server.stop(true);
  }
});

test("a superseded account response cannot revoke queries before the accepted identity arrives", async () => {
  const pending = Promise.withResolvers<Response>();
  const started = Promise.withResolvers<void>();
  let reads = 0;
  const server = Bun.serve({
    port: 0,
    fetch: () => {
      if (++reads === 2) {
        started.resolve();
        return pending.promise;
      }
      return Response.json(status("first"));
    },
  });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "" });
  try {
    const account = getDashboardAccountStatusQuery(owner);
    await account.read();
    const query = getDashboardScopedQueries(owner).query({ id: "notes", read: async () => "first" });
    await query.read();
    publishExtensionEvent({ id: "account.changed" }, owner);
    await started.promise;
    publishExtensionEvent({ id: "account.changed" }, owner);
    pending.resolve(Response.json(status("obsolete")));
    await account.read();
    expect(reads).toBe(3);
    expect(query.isDisposed()).toBe(false);
    expect(account.getSnapshot().data?.login?.accountId).toBe("first");
  } finally {
    await owner.dispose();
    await server.stop(true);
  }
});
