import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extensionResourceRefSchema } from "pstdio-api-contracts";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../../test-utils/create-test-app";
import { createResourcesApi } from "./resources";

test("enabled extensions allocate declared prefixes and reject conflicting installations", async () => {
  const root = mkdtempSync(join(tmpdir(), "resource-prefixes-"));
  const app = await createTestApp();
  try {
    const project = await app.deps.projectService.create({ name: "Prompt Studio" });
    const install = async (name: string, prefix: unknown, projectId = project.id) => {
      const sourcePath = join(root, name);
      mkdirSync(sourcePath, { recursive: true });
      const manifest = {
        name,
        publisher: "example",
        version: "1.0.0",
        main: "extension.ts",
        engines: { pstdio: EXTENSION_API_VERSION },
      };
      writeFileSync(join(sourcePath, "package.json"), JSON.stringify(manifest));
      writeFileSync(
        join(sourcePath, "extension.ts"),
        `export default { resourceKinds: [{id: ${JSON.stringify(name)}, ref: {kind:"resource-kind",id:${JSON.stringify(name)}}, prefix: ${JSON.stringify(prefix)}}] };`,
      );
      return app.deps.extensionService.enableInstalledSourceForProject({
        projectId,
        sourcePath,
        sourceKind: "local_path",
        name,
        installName: name,
        extensionId: `example.${name}`,
        displayName: name,
        manifest,
      });
    };
    const planner = await install("planner", { $prefix: "project" });
    const reports = await install("reports", "RP");
    const preference = await app.deps.extensionAutomationPreferencesService.set({
      project_id: project.id,
      extension_instance_id: planner.instance.id,
      automation_id: "example.planner.schedule.refresh",
      enabled: false,
    });
    expect(app.deps.eventBus.getSince(0).filter((event) => event.table === "extension_automation_preferences")).toEqual(
      [expect.objectContaining({ op: "set", data: preference })],
    );
    const api = (extensionId: string, projectId = project.id) => ({
      allocate: ({ kind }: { kind: string }) =>
        createResourcesApi(app.deps, { projectId, extensionId }).allocate({
          kind: kind === "item" ? extensionId.split(".")[1]! : kind,
        }),
    });
    const first = await api("example.planner").allocate({ kind: "item" });
    expect(first.shorthand).toBe(`${project.shorthand}-1`);
    expect(extensionResourceRefSchema.parse({ type: "item", ...first }).shorthand).toBe(first.shorthand);
    expect((await api("example.reports").allocate({ kind: "item" })).shorthand).toBe("RP-1");
    await expect(install("conflict", "RP")).rejects.toThrow("example.reports");
    expect((await api("example.reports").allocate({ kind: "item" })).shorthand).toBe("RP-2");
    await install("derived-conflict", project.shorthand);
    await expect(api("example.derived-conflict").allocate({ kind: "item" })).rejects.toThrow("example.planner");
    await expect(api("example.reports").allocate({ kind: "undeclared" })).rejects.toThrow("no allocation prefix");
    await app.deps.extensionService.uninstallProjectExtension({
      projectId: project.id,
      instanceId: reports.instance.id,
      deleteUserData: true,
    });
    await install("reports", "RP");
    expect((await api("example.reports").allocate({ kind: "item" })).shorthand).toBe("RP-3");
    const other = await app.deps.projectService.create({ name: "My App" });
    await install("planner", { $prefix: "project" }, other.id);
    expect((await api(planner.installedSource.extension_id, other.id).allocate({ kind: "item" })).shorthand).toBe(
      `${other.shorthand}-1`,
    );
  } finally {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  }
});
