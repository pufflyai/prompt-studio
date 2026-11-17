import { readFileSync } from "node:fs";
import { join } from "node:path";
import { e2eExtension } from "../default-extensions";
import { hostFixtureSources } from "../fixtures/host-fixtures";
import { preparePackagedExtensionSource } from "./packaged-extension-source";
export const packagedFixtureExtensions = async (
  root: string,
  production: string[],
  fixtures: (keyof typeof hostFixtureSources)[],
) => {
  const defaults = production.map(e2eExtension);
  for (const kind of fixtures) {
    const source = await preparePackagedExtensionSource(join(root, "fixtures", kind), hostFixtureSources[kind], {
      install: true,
    });
    const manifest = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
    defaults.push({ source, installName: manifest.name });
  }
  return JSON.stringify({ defaultExtensions: defaults });
};
