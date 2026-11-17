import { expect, test } from "bun:test";
import { createWorkbench, type WorkbenchModuleContext } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import {
  clearCachedDashboardExtensionMetadata,
  emptyDashboardExtensionMetadata,
  setCachedDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { configuredRelatedOpenings } from "./resource-openers";

for (const changed of [false, true]) {
  test(`related openings ${changed ? "discard a changed choice" : "survive an equivalent metadata refresh"}`, async () => {
    const projectId = "related-project";
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const resource = { type: "workspace", id: "workspace", extensionId: "pstdio", projectId };
    const value = [
      { resource: { type: "session", id: "session", extensionId: "pstdio" }, autoOpen: true, region: "side" as const },
    ];
    const server = Bun.serve({
      port: 0,
      async fetch() {
        entered.resolve();
        await release.promise;
        return Response.json({
          commandId: "example.viewer.command.related",
          extensionId: "example.viewer",
          eventIds: [],
          outcome: { ok: true, status: "success", value },
        });
      },
    });
    const runtime = globalThis as typeof globalThis & { __PSTDIO_CONFIG__?: { apiBaseUrl?: string } };
    const previous = runtime.__PSTDIO_CONFIG__;
    runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.origin };
    const ctx = createWorkbench();
    ctx.commands.registerCommand({ id: "example.viewer.command.inspect", label: "Inspect" }, { execute() {} });
    ctx.commands.registerCommand({ id: "example.viewer.command.related", label: "Related" }, { execute() {} });
    selectDashboardProject(ctx, { id: projectId, name: "Related" });
    const metadata = {
      ...emptyDashboardExtensionMetadata,
      composition: {
        resourceOpeners: [
          {
            resourceKind: { kind: "resource-kind" as const, extensionId: "pstdio", id: "workspace" },
            opener: { kind: "command" as const, extensionId: "example.viewer", id: "inspect" },
            relatedOpenings: { kind: "command" as const, extensionId: "example.viewer", id: "related" },
          },
        ],
      },
    };
    setCachedDashboardExtensionMetadata(projectId, metadata);
    const running = configuredRelatedOpenings(ctx as WorkbenchModuleContext, resource, new AbortController().signal);
    try {
      await entered.promise;
      const refreshed = structuredClone(metadata);
      if (changed) refreshed.composition.resourceOpeners[0]!.relatedOpenings.id = "different";
      setCachedDashboardExtensionMetadata(projectId, refreshed);
      release.resolve();
      expect(await running).toEqual(changed ? [] : [{ ...value[0], resource: { ...value[0]!.resource, projectId } }]);
    } finally {
      release.resolve();
      await running;
      clearCachedDashboardExtensionMetadata(projectId);
      ctx.dispose();
      runtime.__PSTDIO_CONFIG__ = previous;
      await server.stop(true);
    }
  });
}
