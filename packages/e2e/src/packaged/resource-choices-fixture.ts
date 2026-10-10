import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

export const writeResourceChoicesExtension = (root: string) => {
  const source = join(root, "extensions", "resource-choices");
  const sdk = join(source, "node_modules", "@pstdio", "sdk");
  mkdirSync(sdk, { recursive: true });
  cpSync(join(import.meta.dirname, "../../../sdk/dist"), join(sdk, "dist"), { recursive: true });
  writeFileSync(
    join(sdk, "package.json"),
    JSON.stringify({ name: "@pstdio/sdk", type: "module", exports: { "./extensions": "./dist/extensions/index.js" } }),
  );
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
};
