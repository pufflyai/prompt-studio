import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../test-utils/create-test-app";

test("resolved provider, board and skill catalogs page beyond fifty without truncating legacy lists", async () => {
  const root = mkdtempSync(join(tmpdir(), "catalog-pages-"));
  const { app, deps, close } = await createTestApp();
  try {
    mkdirSync(join(root, "skills"));
    writeFileSync(join(root, "skills/SKILL.md"), "# Shared skill\n");
    const manifest = {
      name: "catalog-pages",
      publisher: "test",
      version: "1.0.0",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    };
    writeFileSync(join(root, "package.json"), JSON.stringify(manifest));
    writeFileSync(
      join(root, "extension.ts"),
      `const ids=Array.from({length:53},(_,index)=>String(index).padStart(3,"0"));
export default {
 workspaceTypes:ids.map(id=>({id,ref:{kind:"workspace-type",id},label:id,create:async()=>{throw Error("Unused");},resolve:async()=>{throw Error("Unused");}})),
 views:ids.map(id=>({id,ref:{kind:"view",id},title:id,body:{kind:"dataTable",query:()=>({rows:[]})}})),
 skills:ids.map(id=>({id,ref:{kind:"skill",id},title:id,source:{kind:"package-asset",path:"./skills",baseUrl:import.meta.url}})),
};`,
    );
    const project = await deps.projectService.create({ name: "Catalog pages" });
    const enabled = await app.request(`/v1/projects/${project.id}/extensions/installed/catalog-pages/enable`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: "Catalog pages",
        extensionId: "test.catalog-pages",
        manifest,
        name: "catalog-pages",
        sourceKind: "local_path",
        sourcePath: root,
        version: "1.0.0",
      }),
    });
    expect(enabled.status).toBe(200);
    for (const [query, legacy, minimum] of [
      ["workspace-providers/query", "workspace-providers", 53],
      ["boards/query", "boards", 54],
      ["skills/query", "skills", 53],
    ] as const) {
      const base = `/v1/projects/${project.id}/`;
      const response = await app.request(base + query);
      expect(response.status).toBe(200);
      const first = await response.json();
      expect(first.items).toHaveLength(50);
      const last = await (await app.request(`${base}${query}?cursor=${first.nextCursor}`)).json();
      expect(last.items).toHaveLength(minimum - 50);
      expect(last.nextCursor).toBeNull();
      expect(new Set([...first.items, ...last.items].map((item: { id: string }) => item.id)).size).toBe(minimum);
      expect(await (await app.request(base + legacy)).json()).toHaveLength(minimum);
    }
    const snapshot = await deps.extensionRuntimeCatalog.get(project.id);
    const instance = snapshot.enabledSources.find(
      (source) => source.installedSource.extension_id === "test.catalog-pages",
    )!.instance.id;
    const baseRow = {
      project_id: project.id,
      extension_instance_id: instance,
      settings: {
        grouping: "none",
        rowNumbers: false,
        wrapRows: false,
        showStats: false,
        hiddenColumns: [],
        columnOrder: [],
      },
      filter: { conjunction: "and" as const, rules: [] },
      sorts: [],
    };
    await deps.boardViewsService.create({ ...baseRow, board_id: "000", title: "Still declared" });
    for (let index = 0; index < 52; index++)
      await deps.boardViewsService.create({ ...baseRow, board_id: "removed", title: `Orphan ${index}` });
    const path = `/v1/projects/${project.id}/board-views/query?orphaned=true`;
    const first = await (await app.request(path)).json();
    expect(first.items).toHaveLength(50);
    const last = await (await app.request(`${path}&cursor=${first.nextCursor}`)).json();
    expect(last.items).toHaveLength(2);
    expect(last.nextCursor).toBeNull();
    expect(first.items.every((item: { title: string }) => item.title !== "Still declared")).toBe(true);
  } finally {
    await close();
    rmSync(root, { recursive: true, force: true });
  }
});
