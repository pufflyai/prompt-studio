import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

export const writeExtension = (
  root: string,
  entries: Record<string, string>,
  options: { dependencies?: Record<string, string>; version?: string } = {},
) => {
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "lab",
      version: options.version ?? "1.0.0",
      displayName: "Lab",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      dependencies: options.dependencies,
    }),
  );
  for (const entry of Object.values(entries)) {
    if (entry.endsWith(".html")) writeFileSync(join(root, entry), "<!doctype html><p>static</p>");
    else writeFileSync(join(root, entry), "console.log('webview');");
  }

  const views = Object.entries(entries)
    .map(
      ([key, path]) => `{
        id: "${key}",
        title: "${key}",
        body: { kind: "webview", entry: { kind: "package-asset", path: "./${path}", baseUrl: import.meta.url } },
      }`,
    )
    .join(",");

  writeFileSync(
    join(root, "extension.ts"),
    `export default {
      views: [${views}],
    };`,
  );
};

export const writeDependency = (root: string, name: string, version: string) => {
  const dependencyPath = join(root, "node_modules", name);
  mkdirSync(dependencyPath, { recursive: true });
  writeFileSync(join(dependencyPath, "package.json"), JSON.stringify({ name, version }));
};

export const writeManagedBuildOutput = (input: { outdir: string }) => {
  mkdirSync(input.outdir, { recursive: true });
  writeFileSync(join(input.outdir, "module.js"), "");
};
