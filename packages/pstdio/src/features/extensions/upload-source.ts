import { readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { createExtensionIgnoreMatcher, extensionDependencyInputNames } from "pstdio-extensions/authoring";
import { expandHomePath } from "pstdio-paths";

export const isLocalExtensionSource = (source: string) =>
  isAbsolute(source) || /^\.{1,2}[/\\]/.test(source) || /^~[/\\]/.test(source);

export const uploadExtensionSource = (
  source: string,
  options: {
    installName?: string;
    force?: boolean;
    skipInstall?: boolean;
    development?: boolean;
  } = {},
) => {
  const root = resolve(expandHomePath(source, homedir()));
  const body = new FormData();
  body.append("kind", "upload");
  body.append("folderName", basename(root));
  if (options.installName) body.append("installName", options.installName);
  for (const key of ["force", "skipInstall", "development"] as const) {
    if (options[key] !== undefined) body.append(key, String(options[key]));
  }
  const matcher = createExtensionIgnoreMatcher(root, { ignoreGit: false });
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      const rel = relative(root, path).replaceAll("\\", "/");
      if (entry.name === "node_modules") continue;
      const dependencyInput = extensionDependencyInputNames.includes(rel as never);
      const git = rel === ".git" || rel.startsWith(".git/");
      if (!git && !dependencyInput && matcher.ignores(rel)) continue;
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) body.append("files", new File([readFileSync(path)], rel), rel);
    }
  };
  visit(root);
  return body;
};
