import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { APIRequestContext } from "@playwright/test";
import type { EnableInstalledExtensionResponse } from "pstdio-api-contracts";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

export const installShortcutReferenceExtension = async (
  request: APIRequestContext,
  origin: string,
  projectId: string,
) => {
  const root = resolve(import.meta.dirname, "../../../../..");
  const parent = join(root, "__test-tmp__");
  mkdirSync(parent, { recursive: true });
  const sourcePath = mkdtempSync(join(parent, "shortcut-reference-"));
  execFileSync("bun", [
    "build",
    join(import.meta.dirname, "../../fixtures/shortcut-reference/extension.ts"),
    "--target=bun",
    "--outfile",
    join(sourcePath, "extension.ts"),
  ]);
  writeFileSync(
    join(sourcePath, "package.json"),
    JSON.stringify({
      name: "shortcut-reference",
      displayName: "Shortcut reference",
      publisher: "e2e",
      version: "0.1.0",
      main: "extension.ts",
      type: "module",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  const response = await request.post(
    `${origin}/v1/projects/${projectId}/extensions/installed/shortcut-reference/enable`,
    {
      data: {
        displayName: "Shortcut reference",
        extensionId: "e2e.shortcut-reference",
        manifest: { id: "e2e.shortcut-reference", name: "shortcut-reference" },
        name: "shortcut-reference",
        sourceHash: "shortcut-reference",
        sourceKind: "local_path",
        sourcePath,
        sourceRef: null,
        version: "0.1.0",
      },
    },
  );
  if (!response.ok()) throw new Error(await response.text());
  const result = (await response.json()) as EnableInstalledExtensionResponse;
  return { sourcePath, instanceId: result.instanceId };
};
