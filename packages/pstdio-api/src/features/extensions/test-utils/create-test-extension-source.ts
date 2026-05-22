import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const createTestExtensionSource = (fields: {
  displayName: string;
  installName: string;
  name: string;
  root: string;
  version?: string | null;
}) => {
  const sourcePath = join(fields.root, "extensions", fields.installName);
  mkdirSync(sourcePath, { recursive: true });
  writeFileSync(
    join(sourcePath, "package.json"),
    JSON.stringify(
      {
        name: fields.name,
        version: fields.version ?? "0.0.0",
        displayName: fields.displayName,
        publisher: "test",
        main: "./extension.ts",
        engines: { pstdio: "^1.0.0" },
      },
      null,
      2,
    ),
  );
  writeFileSync(join(sourcePath, "extension.ts"), "export default {};\n");
  return sourcePath;
};
