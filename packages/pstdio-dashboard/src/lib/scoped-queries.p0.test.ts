import { expect, test } from "bun:test";
import type { AccountStatus } from "@pstdio/sdk/client";
import { getWorkbenchOperations } from "@pstdio/workbench";
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

test("historical storage resets refresh their canonical native owner without touching other tools", async () => {
  const server = Bun.serve({ port: 0, fetch: () => Response.json(status("first")) });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "" });
  try {
    await getDashboardAccountStatusQuery(owner).read();
    const root = getDashboardScopedQueries(owner);
    let noteReads = 0;
    let homeReads = 0;
    const note = root.forScope({ projectId: "a", extensionId: "pstdio.notes" }).query({
      id: "note",
      read: () => ++noteReads,
    });
    const home = root.forScope({ projectId: "a", extensionId: "pstdio.home" }).query({
      id: "home",
      read: () => ++homeReads,
    });
    await Promise.all([note.read(), home.read()]);
    publishExtensionEventReset({ projectId: "a", extensionId: "pstdio.pstdio-notes" }, owner);
    expect(await note.read()).toBe(2);
    expect(await home.read()).toBe(1);
    publishExtensionEventReset({ projectId: "b", extensionId: "pstdio.notes" }, owner);
    expect(await note.read()).toBe(2);
    publishExtensionEventReset({ projectId: "a", extensionId: "pstdio.notes" }, owner);
    expect(await note.read()).toBe(3);
    publishExtensionEventReset({}, owner);
    expect(await note.read()).toBe(4);
    expect(await home.read()).toBe(2);
  } finally {
    await owner.dispose();
    await server.stop(true);
  }
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
    const projectRetirements: string[] = [];
    const stopRetirements = root.subscribeScopeRetirement(({ projectId }) => {
      if (projectId) projectRetirements.push(projectId);
    });
    const first = account.subscribe(() => {});
    const second = account.subscribe(() => {});
    await account.read();
    expect(reads).toBe(1);
    const query = root.forScope({ projectId: "a" }).query({ id: "notes", read: async () => "private first" });
    const warm = root.forScope({ projectId: "b" }).query({ id: "notes", read: async () => "private warm" });
    const stop = query.subscribe(() => {});
    await Promise.all([query.read(), warm.read()]);
    current = { ...status("second"), cloudProjects: ["a"] };
    publishExtensionEvent({ id: "account.changed" }, owner);
    await account.read();
    expect(reads).toBe(2);
    expect(query.isDisposed()).toBe(true);
    expect(warm.isDisposed()).toBe(true);
    expect(query.getSnapshot().data).toBeUndefined();
    expect(account.getSnapshot().data?.login?.accountId).toBe("second");
    expect(projectRetirements).toEqual([]);
    const replacement = root.forScope({ projectId: "a" }).query({ id: "notes", read: async () => "second" });
    expect(replacement.key).toContain("second");
    current = status("second", "https://different.example");
    publishExtensionEventReset({}, owner);
    await account.read();
    expect(replacement.isDisposed()).toBe(true);
    current = { ...current, cloudProjects: ["b"] };
    publishExtensionEvent({ id: "account.changed" }, owner);
    await account.read();
    expect(projectRetirements).toEqual(["a"]);
    const signedIn = root.forScope({ projectId: "b" }).query({ id: "notes", read: async () => "second" });
    current = { ...current, signInRequired: true, cloudProjects: [] };
    publishExtensionEvent({ id: "account.changed" }, owner);
    await account.read();
    expect(signedIn.isDisposed()).toBe(true);
    expect(projectRetirements).toEqual(["a"]);
    stopRetirements();
    stop();
    first();
    second();
    await turn();
    expect(reads).toBe(5);
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

test("retired recovery follows the owning account's confirmed Cloud roster and surviving local copies", async () => {
  let current = { ...status("first"), cloudProjects: ["shared", "downloaded", "detached", "removed-copy"] };
  const server = Bun.serve({ port: 0, fetch: () => Response.json(current) });
  const owner = createRuntimeCollections({ baseUrl: server.url.origin, token: "" });
  try {
    const rows = owner.getWriter("projects")!;
    rows.upsert({ id: "downloaded" });
    rows.upsert({ id: "removed-copy" });
    owner.markInitialCollectionsSyncComplete();
    const account = getDashboardAccountStatusQuery(owner);
    const operations = getWorkbenchOperations(getDashboardScopedQueries(owner));
    const apply = async (next: AccountStatus) => {
      current = next;
      publishExtensionEvent({ id: "account.changed" }, owner);
      await account.read();
    };
    let writes = 0;
    const loseResponse = (projectId: string, fromCloudPicker = false) =>
      operations.submit({
        projectId,
        subjects: [projectId],
        domain: "recovery",
        title: "Change project",
        draft: projectId,
        ...(fromCloudPicker ? { recoverySource: "cloud-project-picker" } : {}),
        write() {
          writes++;
          throw new Error("Reply lost");
        },
      }).result;
    const unavailableProjects = () =>
      operations
        .getSnapshot()
        .recovery.filter((item) => item.projectUnavailable)
        .map((item) => item.projectId);
    await account.read();
    for (const id of current.cloudProjects)
      await expect(loseResponse(id, id === "shared" || id === "detached")).rejects.toThrow("Reply lost");
    await apply({ ...status("second"), cloudProjects: ["shared"] });
    expect(operations.getSnapshot().recovery).toEqual([]);
    await expect(loseResponse("shared", true)).rejects.toThrow("Reply lost");
    await apply({ ...current, cloudProjects: [], cloudProjectsLoaded: false });
    expect(operations.getSnapshot().pending).toHaveLength(1);
    expect(unavailableProjects()).toEqual([]);
    await apply({ ...current, cloudProjectsLoaded: true });
    expect(operations.getSnapshot().pending).toEqual([]);
    expect(unavailableProjects()).toEqual(["shared"]);
    await apply({ ...status("first"), cloudProjects: ["shared", "removed-copy"] });
    expect(unavailableProjects()).toEqual(["detached"]);
    expect(operations.getSnapshot().recovery.map((item) => item.draft)).toEqual([
      "shared",
      "downloaded",
      "detached",
      "removed-copy",
    ]);
    operations.discard(operations.getSnapshot().recovery[2]!.id);
    rows.remove("downloaded");
    expect(unavailableProjects()).toEqual(["downloaded"]);
    rows.upsert({ id: "downloaded" });
    expect(unavailableProjects()).toEqual([]);
    rows.remove("removed-copy");
    expect(unavailableProjects()).toEqual(["removed-copy"]);
    expect(writes).toBe(5);
  } finally {
    await owner.dispose();
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
