import { describe, expect, test } from "bun:test";

const uiSourceDir = decodeURIComponent(new URL("../../..", import.meta.url).pathname).replace(/\/$/, "");
const forbiddenRuntimeTerms = [
  // This file is excluded from the self-scan by the test/spec filename filter.
  "AgentId",
  "AgentService",
  "AgentRegistry",
  "SpawnedProcess",
];
const forbiddenNodeImportPatterns = [/from\s+["']node:/, /import\s+["']node:/, /import\s*\(\s*["']node:/];

const listUiSourceFiles = () => {
  const glob = new Bun.Glob("**/*.{ts,tsx}");

  return [...glob.scanSync({ cwd: uiSourceDir, absolute: true })].filter((file) => {
    const name = file.split("/").at(-1) ?? "";
    return !name.includes(".test.") && !name.includes(".spec.");
  });
};

const relativeUiSourcePath = (file: string) => {
  if (!file.startsWith(`${uiSourceDir}/`)) return file;
  return file.slice(uiSourceDir.length + 1);
};

describe("chat message types", () => {
  test("do not carry agent runtime contracts or node imports", async () => {
    const violations = await Promise.all(
      listUiSourceFiles().map(async (file) => {
        const source = await Bun.file(file).text();
        const relativePath = relativeUiSourcePath(file);
        const runtimeViolations = forbiddenRuntimeTerms
          .filter((term) => source.includes(term))
          .map((term) => `${relativePath}: ${term}`);
        const nodeImportViolations = forbiddenNodeImportPatterns
          .filter((pattern) => pattern.test(source))
          .map(() => `${relativePath}: node:* import`);

        return [...runtimeViolations, ...nodeImportViolations];
      }),
    );

    expect(violations.flat()).toEqual([]);
  });
});
