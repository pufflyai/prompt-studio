import { describe, expect, test } from "bun:test";
import type {
  ListProjectExtensionsResponse,
  ProjectExtensionInstance,
  WorkbenchExtensionAutomationRecord,
} from "@pstdio/sdk/api";
import { QueryClient } from "@tanstack/react-query";
import { createProjectExtensionCache } from "./project-extension-cache";

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

describe("project extension cache", () => {
  test("cancels an older list read before applying committed enablement", async () => {
    const queryClient = new QueryClient();
    const queryKey = ["project-extensions", "project-1"] as const;
    let resolveOlderRead: ((value: ListProjectExtensionsResponse) => void) | undefined;
    queryClient.setQueryDefaults(queryKey, {
      queryFn: () =>
        new Promise<ListProjectExtensionsResponse>((resolve) => {
          resolveOlderRead = resolve;
        }),
    });
    queryClient.setQueryData(queryKey, response(true));
    const olderRead = queryClient.refetchQueries({ queryKey });
    await Promise.resolve();
    expect(resolveOlderRead).toBeDefined();

    const cache = createProjectExtensionCache(queryClient, "project-1");
    await cache.storeExtension(extension(false));
    resolveOlderRead?.(response(true));
    await olderRead;

    expect(queryClient.getQueryData<ListProjectExtensionsResponse>(queryKey)?.extensions[0]?.enabled).toBe(false);
  });

  test("removes an extension and restores its Marketplace entry", async () => {
    const queryClient = new QueryClient();
    const queryKey = ["project-extensions", "project-1"] as const;
    queryClient.setQueryData(queryKey, response(true));
    const cache = createProjectExtensionCache(queryClient, "project-1");

    await cache.removeExtension("instance-1");

    const result = queryClient.getQueryData<ListProjectExtensionsResponse>(queryKey);
    expect(result?.extensions).toEqual([]);
    expect(result?.marketplace[0]?.installed).toBe(false);
  });

  test("stores an automation preference in both metadata caches", async () => {
    const queryClient = new QueryClient();
    const metadataKey = ["project-extension-metadata", "project-1"] as const;
    const contributionKey = ["extension-contributions", "project-1", "instance-1"] as const;
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
    const metadata = { automations: [automation] };
    queryClient.setQueryData(metadataKey, metadata);
    queryClient.setQueryData(contributionKey, metadata);
    const cache = createProjectExtensionCache(queryClient, "project-1");

    await cache.storeAutomation("instance-1", { ...automation, enabled: false });

    expect(
      queryClient.getQueryData<{ automations: WorkbenchExtensionAutomationRecord[] }>(metadataKey)?.automations,
    ).toContainEqual(expect.objectContaining({ id: automation.id, enabled: false }));
    expect(
      queryClient.getQueryData<{ automations: WorkbenchExtensionAutomationRecord[] }>(contributionKey)?.automations,
    ).toContainEqual(expect.objectContaining({ id: automation.id, enabled: false }));
  });
});
