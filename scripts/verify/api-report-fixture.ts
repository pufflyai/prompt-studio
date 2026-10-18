import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const fixtureCommand = (root: string, command: string[]) => {
  const result = spawnSync(command[0]!, command.slice(1), { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command.join(" ")} failed: ${result.stdout}${result.stderr}`);
  return result.stdout.trim();
};

export const writeFixtureApi = (root: string, version = "0.4.0", parameter = "string") => {
  writeFileSync(
    join(root, "packages/sdk/src/extensions/index.ts"),
    `export const open = (target: ${parameter}) => target;`,
  );
  writeFileSync(
    join(root, "packages/pstdio-api-contracts/src/extension-kernel/types/extension.ts"),
    `export const EXTENSION_API_VERSION = "${version}";`,
  );
};

export const createApiFixture = () => {
  const root = mkdtempSync(join(tmpdir(), "api-report-fixture-"));
  mkdirSync(join(root, "packages/sdk/src/extensions"), { recursive: true });
  mkdirSync(join(root, "packages/pstdio-api-contracts/src/extension-kernel/types"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "api-fixture", private: true }));
  writeFileSync(
    join(root, "packages/sdk/package.json"),
    JSON.stringify({ exports: { "./extensions": "./dist/index.js" } }),
  );
  writeFileSync(
    join(root, "packages/sdk/tsconfig.build.json"),
    JSON.stringify({ compilerOptions: { declaration: true, emitDeclarationOnly: true, stableTypeOrdering: true } }),
  );
  writeFixtureApi(root);
  fixtureCommand(root, ["git", "init", "--initial-branch=main"]);
  fixtureCommand(root, ["git", "config", "user.name", "API fixture"]);
  fixtureCommand(root, ["git", "config", "user.email", "api-fixture@example.test"]);
  fixtureCommand(root, ["git", "add", "."]);
  fixtureCommand(root, ["git", "commit", "-m", "Release API"]);
  fixtureCommand(root, ["git", "tag", "pstdio@0.4.0"]);
  fixtureCommand(root, ["git", "update-ref", "refs/remotes/origin/main", "HEAD"]);
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
};
