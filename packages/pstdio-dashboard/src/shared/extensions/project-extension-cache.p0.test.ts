import { afterEach, describe, expect, test } from "bun:test";
import type {
  ListProjectExtensionsResponse,
  ProjectExtensionInstance,
  WorkbenchExtensionAutomationRecord,
} from "@pstdio/sdk/api";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { emptyWorkbenchExtensionMetadata } from "@pstdio/workbench/extensions";
import { QueryClient } from "@tanstack/react-query";
import { createProjectExtensionCache } from "./project-extension-cache";
import { getProjectExtensionQueries } from "./project-extension-queries";

const extension = (enabled: boolean): ProjectExtensionInstance => ({
  id: "instance-1",
  projectId: "project-1",
  extensionId: "test.example",
  installedExtensionId: "source-1",
  installName: "example",
  name: "example",
  displayName: "Example",
  version: "1.0.0",
  sourcePath: "/extensions/example",
  scope: "global",
  status: "loaded",
  lastLoadedAt: null,
  lastError: null,
  enabled,
  config: {},
  canUpgrade: false,
  updateAvailable: false,
});

const response = (enabled: boolean): ListProjectExtensionsResponse => ({
  extensions: [extension(enabled)],
  marketplace: [
    {
      installName: "example",
      displayName: "Example",
      description: "Example extension",
      installed: true,
      origin: {
        kind: "git",
        url: "https://example.com/extensions.git",
        path: "extensions/example",
        ref: "v1.0.0",
      },
    },
  ],
});

const retained: ReturnType<typeof createScopedQueryClient>[] = [];
afterEach(() => {
  for (const root of retained) root.dispose();
  retained.length = 0;
});
const harness = () => {
  const client = new QueryClient();
  const queries = createScopedQueryClient({ runtimeId: crypto.randomUUID(), extensionId: "pstdio" }, { client });
  retained.push(queries);
  const catalog = getProjectExtensionQueries("project-1", { queries });
  return { client, queries, catalog, cache: createProjectExtensionCache(client, "project-1", queries) };
};

describe("project extension cache", () => {
  test("keeps all known automations when metadata refresh is pending after re-enabling", async () => {
    const { catalog, cache } = harness();
    const automations = ["refine", "implement", "review", "merge"].map((id) => ({
      id,
      localId: id,
      extensionId: "test.example",
      extensionInstanceId: "instance-1",
      title: id,
      cron: "0 * * * *",
      commandId: id,
      enabled: true,
    }));
    catalog.metadata.accept({ ...emptyWorkbenchExtensionMetadata, automations: [] });
    catalog.contributions("instance-1").accept({ ...emptyWorkbenchExtensionMetadata, automations });
    await cache.storeAutomation("instance-1", { ...automations[0], enabled: false });
    const result = catalog.metadata.getSnapshot().data!;
    expect(result.automations).toHaveLength(4);
    expect(result.automations!.filter((item) => item.enabled)).toHaveLength(3);
  });

  test("cancels an older list read before applying committed enablement", async () => {
    const { catalog, cache, queries } = harness();
    const pending = Promise.withResolvers<ListProjectExtensionsResponse>();
    catalog.extensions.accept(response(true));
    const list = queries
      .forScope({ projectId: "project-1" })
      .query({ id: "extensions.list", read: () => pending.promise });
    list.invalidate();
    const olderRead = list.read().catch(() => undefined);
    await cache.storeExtension(extension(false));
    pending.resolve(response(true));
    await olderRead;
    expect(list.getSnapshot().data?.extensions[0]?.enabled).toBe(false);
  });

  test("removes an extension and restores its Marketplace entry", async () => {
    const { catalog, cache } = harness();
    catalog.extensions.accept(response(true));
    await cache.removeExtension("instance-1");
    expect(catalog.extensions.getSnapshot().data?.extensions).toEqual([]);
    expect(catalog.extensions.getSnapshot().data?.marketplace[0]?.installed).toBe(false);
  });

  test("stores an automation preference in both canonical metadata queries", async () => {
    const { catalog, cache } = harness();
    const automation = {
      id: "test.example.schedule.refine",
      localId: "refine",
      extensionId: "test.example",
      extensionInstanceId: "instance-1",
      title: "Refine",
      cron: "0 * * * *",
      commandId: "test.example.command.refine",
      enabled: true,
    } satisfies WorkbenchExtensionAutomationRecord;
    const metadata = { ...emptyWorkbenchExtensionMetadata, automations: [automation] };
    catalog.metadata.accept(metadata);
    catalog.contributions("instance-1").accept(metadata);
    await cache.storeAutomation("instance-1", { ...automation, enabled: false });
    for (const query of [catalog.metadata, catalog.contributions("instance-1")])
      expect(query.getSnapshot().data?.automations).toContainEqual(
        expect.objectContaining({ id: automation.id, enabled: false }),
      );
  });

  test("an old acknowledgement cannot resolve detail queries in a replacement account", async () => {
    const { client, queries } = harness();
    const cache = createProjectExtensionCache(client, "project-1", queries, { instanceId: "instance-1" });
    queries.setAuthority({ accountId: "replacement" });
    const replacement = getProjectExtensionQueries("project-1", { queries });
    const metadata = { ...emptyWorkbenchExtensionMetadata, title: "replacement" };
    replacement.metadata.accept(metadata);
    replacement.contributions("instance-1").accept(metadata);
    await cache.storeAutomation("instance-1", {
      id: "old",
      localId: "old",
      extensionId: "test.example",
      extensionInstanceId: "instance-1",
      title: "Old account",
      cron: "0 * * * *",
      commandId: "old",
      enabled: false,
    });
    expect(cache.active).toBe(false);
    expect(replacement.metadata.getSnapshot().data).toEqual(metadata);
    expect(replacement.contributions("instance-1").getSnapshot().data).toEqual(metadata);
    cache.dispose();
  });

  test("a pending mutation pins its complete inventory until settlement even with no inactive retention", async () => {
    const client = new QueryClient();
    const queries = createScopedQueryClient(
      { runtimeId: "bounded", extensionId: "pstdio" },
      { client, maxInactive: 0 },
    );
    retained.push(queries);
    const cache = createProjectExtensionCache(client, "project-1", queries, { instanceId: "instance-1" });
    const catalog = getProjectExtensionQueries("project-1", { queries });
    const automations = ["one", "two"].map((id) => ({
      id,
      localId: id,
      extensionId: "test.example",
      extensionInstanceId: "instance-1",
      title: id,
      cron: "0 * * * *",
      commandId: id,
      enabled: true,
    }));
    catalog.metadata.accept({ ...emptyWorkbenchExtensionMetadata, automations: [] });
    catalog.contributions("instance-1").accept({ ...emptyWorkbenchExtensionMetadata, automations });
    for (let index = 0; index < 10; index++) queries.query({ id: `other-${index}`, read: () => index });
    await cache.storeAutomation("instance-1", { ...automations[0], enabled: false });
    expect(catalog.metadata.getSnapshot().data?.automations).toEqual([
      { ...automations[0], enabled: false },
      automations[1],
    ]);
    cache.dispose();
    cache.dispose();
    expect(queries.inspect()).toEqual({ active: 0, retained: 0 });
  });
});
