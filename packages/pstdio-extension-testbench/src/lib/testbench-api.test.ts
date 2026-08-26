import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import type { ExtensionBenchCommandResponse, ExtensionBenchLoadResponse } from "./api-contract";
import { createExtensionTestbenchApi } from "./testbench-api";

const apiPrefix = "/__extension-testbench";
const repoRoot = resolve(import.meta.dirname, "../../../..");

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
          kind: "fixture-item",
          uri: "pstdio://extension-resource/fixture-item/pstdio.renderer-context-fixture.view.items",
          id: "pstdio.renderer-context-fixture.view.items",
          label: "extension-testbench",
        },
        group: "Items",
        searchText:
          "extension-testbench pstdio.renderer-context-fixture.view.items pstdio://extension-resource/fixture-item/pstdio.renderer-context-fixture.view.items",
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
          kind: "ticket",
          uri: "pstdio://extension-resource/ticket/PS-16",
          id: "PS-16",
          label: "PS-16 Tree renderer preview",
          icon: "component",
          metadata: {
            shorthand: "PS-16",
            resourceParent: {
              type: "ticket",
              id: "PS-15",
              label: "PS-15 Parent ticket preview",
              metadata: {
                shorthand: "PS-15",
                resourceParent: {
                  type: "view",
                  viewId: "pstdio.pstdio-planner.view.tickets",
                },
              },
            },
          },
        },
        group: "Tickets",
        searchText: "PS-16 Tree renderer preview PS-16 pstdio://extension-resource/ticket/PS-16",
      });
    } finally {
      api.cleanup();
      if (previousHome === undefined) delete process.env.PSTDIO_HOME;
      else process.env.PSTDIO_HOME = previousHome;
    }
  });

  test("renders ticket-linked workspaces in the files tree", async () => {
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
            commandId: "pstdio.pstdio-planner.command.ticket-files.tree.body",
            request: {
              params: {
                renderer: {
                  rendererId: "pstdio.pstdio-planner.view.ticket-files",
                  resource: { type: "ticket", id: "PS-16", label: "PS-16" },
                },
              },
              projectId: bench.projectId,
              source: "dashboard",
            },
          }),
        ),
      );

      const sections = response.outcome.value as Array<{ id: string; nodes: Array<{ id: string }> }>;
      const workspaces = sections.find((section) => section.id === "workspaces");
      expect(workspaces?.nodes.map((node) => node.id)).toEqual(["workspace-ws-preview-1", "workspace-ws-preview-2"]);
    } finally {
      api.cleanup();
      if (previousHome === undefined) delete process.env.PSTDIO_HOME;
      else process.env.PSTDIO_HOME = previousHome;
    }
  });

  test("runs extension middleware before lab commands", async () => {
    const previousHome = process.env.PSTDIO_HOME;
    const api = createExtensionTestbenchApi({ apiPrefix, repoRoot });

    try {
      const bench = await readJson<ExtensionBenchLoadResponse>(
        await api.handleRequest(new Request(`http://bench${apiPrefix}/load?source=./extensions/extension-lab`)),
      );

      const response = await readJson<ExtensionBenchCommandResponse>(
        await api.handleRequest(
          jsonRequest(`http://bench${apiPrefix}/command`, {
            benchId: bench.benchId,
            commandId: "pstdio.extension-lab.command.awaken",
            request: {
              params: { title: "Gain consciousness" },
              projectId: bench.projectId,
              source: "dashboard",
            },
          }),
        ),
      );

      expect(response.outcome).toMatchObject({
        ok: false,
        status: "rejected",
        code: "sentience_rejected",
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
            id: "pstdio.pstdio-base-themes.theme.monokai",
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
            id: "pstdio.pstdio-base-themes.file-icon-theme.seti",
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
