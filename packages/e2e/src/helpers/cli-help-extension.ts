import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

export const writeCliHelpExtension = (root: string) => {
  const source = join(root, "extensions", "help-fixture");
  mkdirSync(source, { recursive: true });
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "help-fixture",
      publisher: "test",
      version: "1.0.0",
      type: "module",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(join(source, "fr.json"), JSON.stringify({ "revision.help": "Comparer la révision actuelle." }));
  writeFileSync(
    join(source, "extension.ts"),
    `export default {
      defaultLocale: "en",
      translations: { fr: { kind: "package-asset", path: "./fr.json", baseUrl: import.meta.url } },
      commands: [{ id: "read", ref: { kind: "command", id: "read" }, title: "Read", cli: true,
        params: { revision: { type: "number", description: { $l10n: "revision.help", default: "Compare the current revision." } } },
        run(_ctx, input) { return input.revision ?? 0; }
      }]
    };`,
  );
};
