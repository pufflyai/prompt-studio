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
            commandId: "extension-lab.awaken",
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
        await api.handleRequest(new Request(`http://bench${apiPrefix}/load?source=./extensions/extension-lab`)),
      );

      expect(bench.inventory.themes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "extension-lab.glassLab",
            mode: "dark",
            tokens: expect.objectContaining({ "colors.bg": "#07100F" }),
            monacoTheme: expect.objectContaining({ base: "vs-dark" }),
            sourcePath: "./themes/glass-lab-color-theme.json",
          }),
        ]),
      );
      expect(bench.inventory.fileIconThemes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "extension-lab.glassLab",
            sourcePath: "./icons/glass-lab-icon-theme.json",
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
