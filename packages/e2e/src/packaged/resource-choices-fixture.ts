import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { installBuiltSdk } from "../helpers/installed-sdk";

export const writeResourceChoicesExtension = (root: string) => {
  const source = join(root, "extensions", "resource-choices");
  mkdirSync(source, { recursive: true });
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "resource-choices",
      publisher: "e2e",
      version: "0.1.0",
      main: "extension.ts",
      type: "module",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  cpSync(join(import.meta.dirname, "../fixtures/resource-choices/extension.ts"), join(source, "extension.ts"));
  installBuiltSdk(source);
};
