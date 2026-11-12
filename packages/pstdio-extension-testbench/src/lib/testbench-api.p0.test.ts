import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ExtensionBenchCommandResponse, ExtensionBenchLoadResponse } from "./api-contract";
import { createExtensionTestbenchApi } from "./testbench-api";

const apiPrefix = "/__extension-testbench";
const repoRoot = resolve(import.meta.dirname, "../../../..");
const plannerManifest = JSON.parse(readFileSync(resolve(repoRoot, "extensions/pstdio-planner/package.json"), "utf8"));
const authoredTicketsView = `${plannerManifest.publisher}.${plannerManifest.name}.view.tickets`;

const readJson = async <T>(response: Response | undefined) => {
  expect(response).toBeDefined();
  expect(response?.ok).toBe(true);
  return (await response!.json()) as T;
};

const jsonRequest = (url: string, body: unknown) =>
  new Request(url, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

describe("createExtensionTestbenchApi", () => {
  test("passes renderer context while collecting testbench resources", async () => {
    const previousHome = process.env.PSTDIO_HOME;
    const api = createExtensionTestbenchApi({ apiPrefix, repoRoot });

    try {
      const bench = await readJson<ExtensionBenchLoadResponse>(
        await api.handleRequest(
          new Request(
            `http://bench${apiPrefix}/load?source=./packages/pstdio-extension-testbench/src/lib/fixtures/renderer-context`,
          ),
        ),
      );

      expect(bench.resources).toContainEqual({
        resource: {
          type: "fixture-item",
          id: "pstdio.renderer-context-fixture.view.items",
          label: "extension-testbench",
        },
        group: "Items",
        searchText: "extension-testbench pstdio.renderer-context-fixture.view.items fixture-item",
      });
    } finally {
      api.cleanup();
      if (previousHome === undefined) delete process.env.PSTDIO_HOME;
      else process.env.PSTDIO_HOME = previousHome;
    }
  });

  test("loads planner ticket rows as testbench resources", async () => {
    const previousHome = process.env.PSTDIO_HOME;
    const api = createExtensionTestbenchApi({ apiPrefix, repoRoot });

    try {
      const bench = await readJson<ExtensionBenchLoadResponse>(
        await api.handleRequest(new Request(`http://bench${apiPrefix}/load?source=./extensions/pstdio-planner`)),
      );

      expect(bench.resources).toContainEqual({
        resource: {
          type: "ticket",
          id: "PS-16",
          projectId: "extension-testbench",
          label: "PS-16 Tree renderer preview",
          icon: "component",
          shorthand: "PS-16",
          metadata: {
            archived: false,
            resourceParent: {
              type: "ticket",
              id: "PS-15",
              label: "PS-15 Parent ticket preview",
              shorthand: "PS-15",
              metadata: {
                resourceParent: {
                  type: "view",
                  viewId: authoredTicketsView,
                },
              },
            },
          },
        },
        group: "Tickets",
        searchText: "PS-16 Tree renderer preview PS-16 ticket",
      });
    } finally {
      api.cleanup();
      if (previousHome === undefined) delete process.env.PSTDIO_HOME;
      else process.env.PSTDIO_HOME = previousHome;
    }
  });

  test("renders seeded workspaces in the ticket tree and linked-resource badges", async () => {
    const previousHome = process.env.PSTDIO_HOME;
    const api = createExtensionTestbenchApi({ apiPrefix, repoRoot });

    try {
      const bench = await readJson<ExtensionBenchLoadResponse>(
        await api.handleRequest(new Request(`http://bench${apiPrefix}/load?source=./extensions/pstdio-planner`)),
      );

      const response = await readJson<ExtensionBenchCommandResponse>(
        await api.handleRequest(
          jsonRequest(`http://bench${apiPrefix}/command`, {
            benchId: bench.benchId,
            commandId: "pstdio.planner.command.ticket-files.tree.body",
            request: {
              params: {
                renderer: {
                  rendererId: "pstdio.planner.view.ticket-files",
                  resource: { type: "ticket", id: "PS-16", label: "PS-16" },
                },
              },
              projectId: bench.projectId,
              source: "dashboard",
            },
          }),
        ),
      );

      if (!response.outcome.ok) throw new Error(response.outcome.reason);
      const sections = response.outcome.value as Array<{ id: string; nodes: Array<{ id: string }> }>;
      const workspaces = sections.find((section) => section.id === "workspaces");
      expect(workspaces?.nodes.map((node) => node.id)).toEqual(["workspace-ws-preview-1", "workspace-ws-preview-2"]);

      const cards = await readJson<ExtensionBenchCommandResponse>(
        await api.handleRequest(
          jsonRequest(`http://bench${apiPrefix}/command`, {
            benchId: bench.benchId,
            commandId: "pstdio.planner.command.query-tickets",
            request: { params: {}, projectId: bench.projectId, source: "dashboard" },
          }),
        ),
      );
      if (!cards.outcome.ok) throw new Error(cards.outcome.reason);
      const rows = cards.outcome.value as {
        rows: { id: string; attributes: { linkedResourceItems: { label: string; action?: unknown }[] } }[];
      };
      const badges = rows.rows.find((row) => row.id === "PS-16")?.attributes.linkedResourceItems;
      expect(badges?.map((item) => item.label).sort()).toEqual(["WS-1", "WS-2"]);
      expect(badges).toEqual([
        expect.objectContaining({ action: expect.objectContaining({ kind: "page" }) }),
        expect.objectContaining({ action: expect.objectContaining({ kind: "page" }) }),
      ]);
    } finally {
      api.cleanup();
      if (previousHome === undefined) delete process.env.PSTDIO_HOME;
      else process.env.PSTDIO_HOME = previousHome;
    }
  });

  test("runs extension middleware before commands and stops rejected requests", async () => {
    const previousHome = process.env.PSTDIO_HOME;
    const api = createExtensionTestbenchApi({ apiPrefix, repoRoot });

    try {
      const bench = await readJson<ExtensionBenchLoadResponse>(
        await api.handleRequest(
          new Request(
            `http://bench${apiPrefix}/load?source=./packages/pstdio-extension-testbench/src/lib/fixtures/command-middleware`,
          ),
        ),
      );

      const execute = async (title: string) =>
        readJson<ExtensionBenchCommandResponse>(
          await api.handleRequest(
            jsonRequest(`http://bench${apiPrefix}/command`, {
              benchId: bench.benchId,
              commandId: "pstdio.command-middleware-fixture.command.execute",
              request: {
                params: { title },
                projectId: bench.projectId,
                source: "dashboard",
              },
            }),
          ),
        );

      expect((await execute("first")).outcome).toMatchObject({
        ok: true,
        status: "success",
        value: { title: "first", executions: 1 },
      });
      expect((await execute("blocked")).outcome).toMatchObject({
        ok: false,
        status: "rejected",
        code: "title_blocked",
      });
      expect((await execute("second")).outcome).toMatchObject({
        ok: true,
        status: "success",
        value: { title: "second", executions: 2 },
      });
    } finally {
      api.cleanup();
      if (previousHome === undefined) delete process.env.PSTDIO_HOME;
      else process.env.PSTDIO_HOME = previousHome;
    }
  });

  test("loads extension appearance contributions into the inventory", async () => {
    const previousHome = process.env.PSTDIO_HOME;
    const api = createExtensionTestbenchApi({ apiPrefix, repoRoot });

    try {
      const bench = await readJson<ExtensionBenchLoadResponse>(
        await api.handleRequest(new Request(`http://bench${apiPrefix}/load?source=./extensions/pstdio-base-themes`)),
      );

      expect(bench.inventory.themes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "pstdio.base-themes.theme.monokai",
            mode: "dark",
            tokens: expect.objectContaining({ "colors.bg": "#272822" }),
            monacoTheme: expect.objectContaining({ base: "vs-dark" }),
            sourcePath: "./themes/monokai-color-theme.json",
          }),
        ]),
      );
      expect(bench.inventory.fileIconThemes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "pstdio.base-themes.file-icon-theme.seti",
            sourcePath: "./icons/seti-icon-theme.json",
          }),
        ]),
      );
    } finally {
      api.cleanup();
      if (previousHome === undefined) delete process.env.PSTDIO_HOME;
      else process.env.PSTDIO_HOME = previousHome;
    }
  });
});
