import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

export const selectedComponentFiles = (json: string | undefined) => {
  if (json === undefined) return [];
  const files: unknown = JSON.parse(json);
  if (!Array.isArray(files) || files.length === 0) throw new Error("Component files must be a nonempty array");
  for (const file of files) {
    if (
      typeof file !== "string" ||
      !/^src\/ui\/[a-z0-9-]+\.spec\.ts$/.test(file) ||
      !existsSync(resolve(import.meta.dir, "../..", file))
    )
      throw new Error(`Invalid component spec: ${file}`);
  }
  if (new Set(files).size !== files.length) throw new Error("Duplicate component spec");
  return files as string[];
};

export const browserArguments = (args: string[], priority = process.env.CI_PRIORITY ?? "P1", filesJson?: string) => [
  "test",
  ...selectedComponentFiles(filesJson),
  ...args,
  `--max-failures=${priority === "P1" ? 1 : 0}`,
];

if (import.meta.main) {
  const child = spawn(
    "node",
    [
      createRequire(import.meta.url).resolve("@playwright/test/cli"),
      ...browserArguments(process.argv.slice(2), process.env.CI_PRIORITY, process.env.COMPONENT_TEST_FILES),
    ],
    {
      env: process.env,
      stdio: "inherit",
    },
  );
  child.on("error", (error) => {
    console.error(error);
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}
