import { execFile } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { type APIRequestContext, expect } from "@playwright/test";

export const installPresentationTool = async (request: APIRequestContext, projectId: string) => {
  const source = mkdtempSync(join(tmpdir(), "presentation-tool-"));
  try {
    cpSync(join(import.meta.dirname, "../../fixtures/presentation-tool"), source, { recursive: true });
    // Install the fixture's published SDK in its own package, without source aliases or host imports.
    await promisify(execFile)("bun", ["install", "--ignore-scripts"], { cwd: source });
    const enabled = await request.post(`/v1/projects/${projectId}/extensions/installed/presentation-tool/enable`, {
      data: {
        displayName: "Alternative presentation",
        extensionId: "test.presentation-tool",
        manifest: { id: "test.presentation-tool", name: "presentation-tool" },
        name: "presentation-tool",
        sourceHash: "presentation-fixture",
        sourceKind: "local_path",
        sourcePath: source,
        sourceRef: null,
        version: "1.0.0",
      },
    });
    expect(enabled.ok(), await enabled.text()).toBe(true);
    return () => rmSync(source, { recursive: true, force: true });
  } catch (error) {
    rmSync(source, { recursive: true, force: true });
    throw error;
  }
};
