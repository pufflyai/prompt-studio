import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { remapPackageAssets } from "./remap-package-assets";

test("relocates nested package assets while retaining external bases and callbacks", () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "remap-package-assets-")));
  const source = join(root, "prepared");
  const target = join(root, "installed");
  const module = join(source, "nested", "definition.ts");
  const externalModule = join(root, "external.ts");
  mkdirSync(join(source, "nested"), { recursive: true });
  writeFileSync(module, "export default {};");
  writeFileSync(externalModule, "export default {};");
  const callback = () => [];
  const descriptor = (path: string) => ({
    kind: "package-asset",
    path: "./view.tsx",
    baseUrl: pathToFileURL(path).href,
  });
  const value = { views: [{ entry: descriptor(module) }, { entry: descriptor(externalModule) }], query: callback };
  try {
    const mapped = remapPackageAssets(value, source, target) as typeof value;
    expect(mapped.views[0]?.entry.baseUrl).toBe(pathToFileURL(join(target, "nested", "definition.ts")).href);
    expect(mapped.views[1]?.entry).toEqual(value.views[1]?.entry);
    expect(mapped.query).toBe(callback);
    expect(value.views[0]?.entry.baseUrl).toBe(pathToFileURL(module).href);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
