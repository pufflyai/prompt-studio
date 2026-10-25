import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { stagePackage } from "./stage-package";

export const stageSdkPackage = (root: string) => {
  const destination = stagePackage(root);
  const path = join(destination, "package.json");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  writeFileSync(
    path,
    `${JSON.stringify({ ...manifest, pstdio: { extensionApiVersion: EXTENSION_API_VERSION } }, null, 2)}\n`,
  );
  return destination;
};

if (import.meta.main) console.log(stageSdkPackage(process.argv[2] ?? process.cwd()));
