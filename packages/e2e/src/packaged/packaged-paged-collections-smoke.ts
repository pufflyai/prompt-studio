import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_DATA_TABLE_SETTINGS } from "@pstdio/sdk/extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { initialFixturePage } from "./fixtures/paged-collection-extension";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";
import { writePagedCollectionFixtures } from "./paged-collection-fixtures";

export const registerPagedCollectionSmokeTests = () => {
  test(
    "ten public owners return bounded collection pages with isolated revisions and totals",
    async () => {
      const root = mkdtempSync(join(tmpdir(), "packaged-paged-collections-"));
      const fixtures = await writePagedCollectionFixtures(root);
      const host = await startPackagedServe(root, { PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify(fixtures) });
      const headers = { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" };
      const post = (path: string, body: unknown) =>
        fetch(`${host.baseUrl}/v1${path}`, { method: "POST", headers, body: JSON.stringify(body) });
      try {
        const created = await post("/projects", folderProjectInput({ name: "Paged public owners" }, root));
        expect(created.status).toBe(201);
        const project = (await created.json()) as { id: string };
        const prefix = `/projects/${project.id}/extensions`;
        const command = async (id: string, params: unknown = {}) => {
          const response = await post(`${prefix}/commands/${id}/execute`, { params });
          expect(response.status).toBe(200);
          const body = await response.json();
          expect(body.outcome, JSON.stringify(body)).toMatchObject({ ok: true });
          return body.outcome.value;
        };
        const metadata = await (await fetch(`${host.baseUrl}/v1${prefix}/ui`, { headers })).json();
        for (let owner = 0; owner < 10; owner++) {
          const extensionId = `example.paged-owner-${owner}`;
          await command(`${extensionId}.command.seed`);
          const table = metadata.views.find(
            (view: { extensionId: string; localId: string }) =>
              view.extensionId === extensionId && view.localId === "table",
          );
          expect(table.body.queryMode).toBe("paged");
          const input = {
            renderer: { projectId: project.id },
            filter: { conjunction: "and", rules: [] },
            sorts: [{ attributeId: "rank", direction: "asc" }],
            settings: { ...DEFAULT_DATA_TABLE_SETTINGS, showStats: false },
            page: initialFixturePage,
          };
          const first = await command(table.body.queryHandlerId, input);
          expect(first.rows).toHaveLength(100);
          expect(first.rows[0].values.title).toBe(`paged-owner-${owner} row 0000`);
          expect(first.rows[99].values.title).toBe(`paged-owner-${owner} row 0099`);
          expect(first.page).toMatchObject({
            total: 250,
            filteredTotal: 250,
            groups: [
              { field: "status", value: "done", count: 125 },
              { field: "status", value: "todo", count: 125 },
            ],
          });
          expect(JSON.stringify(first)).not.toContain("OFF_PAGE_BODY");
          const next = await command(table.body.queryHandlerId, {
            ...input,
            page: { ...input.page, offset: 100, cursor: first.page.cursor, revision: first.page.revision },
          });
          expect(next.rows[0].values.title).toBe(`paged-owner-${owner} row 0100`);
          const last = await command(table.body.queryHandlerId, {
            ...input,
            page: { ...input.page, offset: 200, revision: first.page.revision },
          });
          expect(last.rows).toHaveLength(50);
          expect(last.page.cursor).toBeNull();
          const searched = await command(table.body.queryHandlerId, {
            ...input,
            page: { ...input.page, search: "row 024" },
          });
          expect(searched.rows).toHaveLength(10);
          expect(searched.page.filteredTotal).toBe(10);
          const grouped = await command(table.body.queryHandlerId, {
            ...input,
            settings: { ...input.settings, grouping: "status" },
            page: { ...input.page, collapsedGroups: ["done"] },
          });
          expect(grouped.page.filteredTotal).toBe(125);
          expect(grouped.rows.every((row: { values: { status: string } }) => row.values.status === "todo")).toBe(true);
          if (owner === 0) {
            const exact = await command(table.body.queryHandlerId, {
              ...input,
              filter: {
                conjunction: "and",
                rules: [{ attributeId: "title", condition: "is", value: "PAGED-OWNER-0 ROW 0000" }],
              },
            });
            expect(exact.rows).toHaveLength(1);
            expect(exact.page.filteredTotal).toBe(1);
            const excluded = await command(table.body.queryHandlerId, {
              ...input,
              filter: {
                conjunction: "and",
                rules: [{ attributeId: "title", condition: "does-not-contain", value: "ROW 00" }],
              },
            });
            expect(excluded.rows).toHaveLength(100);
            expect(excluded.page.filteredTotal).toBe(150);
            expect(excluded.rows[0].values.title).toBe("paged-owner-0 row 0100");
          }
        }
      } finally {
        await stopProcess(host.child);
        rmSync(root, { recursive: true, force: true });
      }
    },
    PACKAGED_TEST_TIMEOUT,
  );
};
