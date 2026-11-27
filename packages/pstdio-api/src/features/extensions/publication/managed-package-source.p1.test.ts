import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNativeStore } from "../../../services/account/native-store";
import { createProjectCopyStore } from "../../../services/account/project-copy-store";
import { createTestApp } from "../../../test-utils/create-test-app";
import { expectRejection } from "../../../test-utils/expect-rejection";
import { createTestExtensionSource } from "../test-utils/create-test-extension-source";
import { exportManagedPackage } from "./managed-package-source";

test("sharing a managed package requires current access to its source team project", async () => {
  const root = await mkdtemp(join(tmpdir(), "managed-source-access-"));
  let granted = true;
  let revokeAfterPermission = false;
  let projectId = "source";
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/v1/account") return Response.json({ features: { relay: false } });
      if (url.pathname === "/v1/workbenches")
        return Response.json(
          url.searchParams.get("accountId") === "source-team" && granted
            ? [{ workbenchId: projectId, grantId: "source-grant" }]
            : [],
        );
      if (url.pathname === "/v1/environment-access") {
        if (revokeAfterPermission) {
          revokeAfterPermission = false;
          granted = false;
        }
        return Response.json({ canPublish: true });
      }
      return Response.json([]);
    },
  });
  const app = await createTestApp({ storageRoot: join(root, "storage") });
  try {
    const project = await app.deps.projectService.create({ name: "Private source project" });
    projectId = project.id;
    const source = createTestExtensionSource({
      root,
      installName: "private-tool",
      name: "private-tool",
      displayName: "Private tool",
    });
    const { instance } = await app.deps.extensionService.enableInstalledSourceForProject({
      projectId,
      sourcePath: source,
      name: "private-tool",
      installName: "private-tool",
      displayName: "Private tool",
      extensionId: "test.private-tool",
      version: "0.0.0",
      manifest: {},
    });
    const file = join(root, "storage", "native-account.json");
    await createNativeStore(file).save({
      managerOrigin: manager.url.origin,
      relayOrigin: manager.url.origin,
      accountId: "member",
      deviceId: (await app.deps.environmentService.get()).environmentId,
      token: "fixture-device-credential",
    });
    await createProjectCopyStore(file).bindTeamProject(
      {
        managerOrigin: manager.url.origin,
        accountId: "source-team",
        projectId,
      },
      async () => true,
    );
    expect((await exportManagedPackage(app.deps, projectId, instance.id)).extensionId).toBe("test.private-tool");
    granted = false;
    await expectRejection(exportManagedPackage(app.deps, projectId, instance.id)).toThrow("Current project access");
    granted = true;
    revokeAfterPermission = true;
    await expectRejection(exportManagedPackage(app.deps, projectId, instance.id)).toThrow("Current project access");
  } finally {
    await app.close();
    await manager.stop(true);
    await rm(root, { recursive: true, force: true });
  }
});
