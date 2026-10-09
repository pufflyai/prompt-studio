import { afterEach, beforeEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import {
  installExtensionSource,
  RepoScopedExtensionNeedsProjectFolderError,
} from "../features/extensions/install-extension-source";
import { createExtensionSourceInstaller } from "./extension-source-installer";

let root: string;
let previousHome: string | undefined;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "host-source-install-"));
  previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
});
afterEach(() => {
  if (previousHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousHome;
  rmSync(root, { recursive: true, force: true });
});
const manifest = (scope = "user", version = "1.0.0") =>
  JSON.stringify({
    name: "tool",
    publisher: "test",
    version,
    main: "./extension.ts",
    pstdio: { scope },
    engines: { pstdio: `^${EXTENSION_API_VERSION}` },
  });
const source = (path: string, scope = "user", version = "1.0.0") => {
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, "package.json"), manifest(scope, version));
  writeFileSync(join(path, "extension.ts"), "export default {};");
};
const git = (cwd: string, ...args: string[]) => {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
};
const installer = (workspace: { root_path: string | null; execution_kind: string }, origin?: string) => {
  const entry = {
    installName: "catalog-tool",
    displayName: "Tool",
    description: "",
    default: false,
    origin: { kind: "git" as const, url: origin ?? "file:///unused", path: "tool", ref: "{hostRelease}" },
  };
  return createExtensionSourceInstaller({
    deps: {
      workspaceService: { getDefault: async () => workspace },
      release: { source: "git", ref: "host-release" },
    } as never,
    install: installExtensionSource,
    catalogEntry: async (name) => (name === "catalog-tool" ? entry : undefined),
    releaseRefFor: () => "host-release",
  });
};

test("installs catalog refs chosen by the host and respects an explicit branch and name", async () => {
  const repo = join(root, "catalog");
  source(join(repo, "tool"));
  git(repo, "init", "-b", "host-release");
  git(repo, "add", ".");
  git(repo, "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "First release");
  git(repo, "checkout", "-b", "development");
  source(join(repo, "tool"), "user", "2.0.0");
  git(repo, "add", ".");
  git(repo, "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "Development");
  const install = installer({ root_path: null, execution_kind: "remote" }, new URL(`file://${repo}`).href);
  const first = await install("project", { source: { kind: "catalog", name: "catalog-tool" }, skipInstall: true });
  expect(first.metadata.version).toBe("1.0.0");
  expect(first.targetPath).toBe(join(root, "home/extensions/catalog-tool"));
  const branch = await install("project", {
    source: { kind: "catalog", name: "catalog-tool", ref: "development" },
    installName: "custom",
    skipInstall: true,
  });
  expect(branch.metadata.version).toBe("2.0.0");
  expect(branch.installName).toBe("custom");
  expect(branch.source.kind).toBe("named");
});

test("does not treat a remote execution path as a host project folder", async () => {
  const install = installer({ root_path: join(root, "remote"), execution_kind: "remote" });
  const files = [new File([manifest("repo")], "package.json"), new File(["export default {};"], "extension.ts")];
  await expect(
    install("project", {
      kind: "upload",
      folderName: "tool",
      files,
      force: false,
      skipInstall: true,
      development: false,
    }),
  ).rejects.toBeInstanceOf(RepoScopedExtensionNeedsProjectFolderError);
});

test("rejects project source symlinks that leave the owning workspace", async () => {
  const project = join(root, "project");
  const outside = join(root, "outside");
  mkdirSync(project);
  source(outside);
  symlinkSync(outside, join(project, "linked"), "junction");
  const install = installer({ root_path: project, execution_kind: "local" });
  await expect(
    install("project", {
      source: { kind: "project-folder", path: "linked" },
      skipInstall: true,
    }),
  ).rejects.toThrow("leaves the host project");
});
