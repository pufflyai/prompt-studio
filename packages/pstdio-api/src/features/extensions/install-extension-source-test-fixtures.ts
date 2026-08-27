import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

const packageManifest = (
  fields: Partial<{ id: string; namespace: string; name: string }> & Record<string, unknown> = {},
) => {
  const { id, namespace, name, ...rest } = fields;
  return {
    name: namespace ?? "test",
    version: "1.2.3",
    displayName: name ?? "Test Extension",
    publisher: id?.split(".")[0] ?? "test",
    main: "./extension.ts",
    engines: { pstdio: EXTENSION_API_VERSION },
    ...rest,
  };
};

export const writeManifest = (dir: string, fields: Record<string, unknown> = {}) => {
  writeFileSync(join(dir, "package.json"), JSON.stringify(packageManifest(fields), null, 2));
};

export const makeExtension = (
  dir: string,
  fields: Partial<{ id: string; namespace: string; name: string }> & Record<string, unknown> = {},
) => {
  mkdirSync(dir, { recursive: true });
  writeManifest(dir, fields);
  writeFileSync(
    join(dir, "extension.ts"),
    `export default {
  commands: [
    {
      id: "hello",
      ref: { kind: "command", id: "hello" },
      title: "Hello",
      run() {
        throw new Error("command handlers must not run during install");
      },
    },
  ],
  templates: [
    {
      id: "ticket",
      ref: { kind: "template", id: "ticket" },
      title: "Ticket",
      type: "ticket",
      source: { kind: "package-asset", path: "./ticket.md", baseUrl: import.meta.url },
    },
  ],
};`,
  );
  writeFileSync(join(dir, "ticket.md"), "# ticket\n");
};
