import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TeamExtensionPolicy } from "pstdio-sync-contracts";
import { AccountRequestError } from "../../services/account/account-errors";
import { createExtensionUpgradeService } from "../../services/extension-upgrade-service";
import { createTestApp } from "../../test-utils/create-test-app";
import { namedSourceRef } from "./install-extension-source";
import { listProjectExtensionInventory } from "./project-extension-inventory";
import { createTestExtensionSource } from "./test-utils/create-test-extension-source";

test("inventory separates required project choices from a source shared with a team project", async () => {
  const root = await mkdtemp(join(tmpdir(), "extension-restrictions-"));
  const app = await createTestApp();
  try {
    const team = await app.deps.projectService.create({ name: "Team" });
    const personal = await app.deps.projectService.create({ name: "Personal" });
    const sourcePath = createTestExtensionSource({
      root,
      name: "tools",
      installName: "restriction-tools",
      displayName: "Tools",
    });
    app.deps.extensionUpgradeService = createExtensionUpgradeService({
      extensionService: app.deps.extensionService,
      workspaceService: app.deps.workspaceService,
      release: { source: "workspace", ref: "b".repeat(40), root },
      catalog: { version: 1, extensions: [] },
      resolveReleaseCommit: async () => "b".repeat(40),
    });
    const extensionId = "test.tools";
    for (const project of [team, personal])
      await app.deps.extensionService.enableInstalledSourceForProject({
        projectId: project.id,
        extensionId,
        sourcePath,
        installName: "restriction-tools",
        name: "tools",
        displayName: "Tools",
        manifest: {},
        sourceHash: "original",
        sourceKind: "git",
        sourceRef: namedSourceRef("a".repeat(40), {
          kind: "git",
          url: "https://github.com/fixture/restriction-tools",
          path: "extensions/tools",
          ref: "main",
        }),
      });
    let policy: TeamExtensionPolicy[] = [
      {
        extensionId,
        selectionId: "required",
        required: {
          extensionId,
          selectionId: "required",
          name: "Tools",
          version: "1.0.0",
          revision: "a".repeat(64),
        },
      },
    ];
    let denied = false;
    app.deps.accountService.readCachedManagedProjectPolicy = async (projectId) => {
      if (projectId !== team.id) return [];
      if (denied) throw new AccountRequestError("Connect to Cloud");
      return policy;
    };
    const inventory = async (projectId: string) => {
      const result = await listProjectExtensionInventory(app.deps, projectId);
      return result.extensions.find((row) => row.extensionId === extensionId)!;
    };
    expect(await inventory(team.id)).toMatchObject({
      choiceRestriction: "team-managed",
      sourceRestriction: "team-managed",
      canUpgrade: false,
    });
    const personalRow = await inventory(personal.id);
    expect(personalRow).toMatchObject({ sourceRestriction: "team-managed", canUpgrade: false });
    expect(personalRow).not.toHaveProperty("choiceRestriction");
    await app.deps.extensionService.setProjectExtensionEnabled(personalRow.id, false);
    denied = true;
    expect(await inventory(personal.id)).toMatchObject({ sourceRestriction: "policy-unavailable", enabled: false });
    denied = false;
    policy = [{ extensionId, selectionId: "released", required: null }];
    const released = await inventory(team.id);
    expect(released).not.toHaveProperty("choiceRestriction");
    expect(released).not.toHaveProperty("sourceRestriction");
    expect(released.canUpgrade).toBe(true);
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
