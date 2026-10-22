import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extensionResourceRefSchema } from "pstdio-api-contracts";
import { EXTENSION_API_VERSION, resourceEvents } from "pstdio-api-contracts/extension-kernel";
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
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
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
      allocate: ({ kind, idPrefix }: { kind: string; idPrefix?: string }) =>
        createResourcesApi(app.deps, { projectId, extensionId }).allocate({
          kind: kind === "item" ? extensionId.split(".")[1]! : kind,
          idPrefix,
        }),
    });
    await expect(api("example.planner").allocate({ kind: "item", idPrefix: "INVALID" })).rejects.toThrow("ID prefix");
    const first = await api("example.planner").allocate({ kind: "item", idPrefix: "tk" });
    expect(first.id).toMatch(/^tk_[0-9A-Za-z]{22}$/);
    expect(first.shorthand).toBe(`${project.shorthand}-1`);
    const resources = createResourcesApi(app.deps, { projectId: project.id, extensionId: "example.planner" });
    const identity = { ...first, kind: "planner", aliases: [] };
    expect(await resources.identity({ kind: "planner", id: first.id })).toEqual(identity);
    expect(await resources.findByShorthand({ kind: "planner", shorthand: first.shorthand })).toEqual([identity]);
    await expect(resources.identity({ kind: "reports", id: first.id })).rejects.toThrow("not owned");
    await expect(resources.findByShorthand({ kind: "reports", shorthand: first.shorthand })).rejects.toThrow(
      "not owned",
    );
    const dispatched = Promise.withResolvers<unknown>();
    const stopEvents = app.deps.eventBus.subscribe((event) => {
      const data = event.data as { eventId?: string };
      if (event.table === "extension_events" && data.eventId === resourceEvents.renumbered.id) dispatched.resolve(data);
    });
    await app.deps.extensionResourceSequencesService.documentStore.transaction(
      { workbenchId: project.id, extensionId: "pstdio" },
      async ({ document }) => {
        const numbers = document.getMap<{ id: string }>("resource-numbers");
        numbers.set("zz-offline", { ...numbers.get(first.id)!, id: "zz-offline" });
      },
    );
    expect(await dispatched.promise).toMatchObject({ projectId: project.id, eventId: resourceEvents.renumbered.id });
    stopEvents();
    expect(await resources.findByShorthand({ kind: "planner", shorthand: first.shorthand })).toHaveLength(2);
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
