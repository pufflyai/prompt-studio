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
});
