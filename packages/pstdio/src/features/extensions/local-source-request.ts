import { realpathSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { InstallExtensionRequest } from "@pstdio/sdk/api";
import { unpackExtension } from "pstdio-extensions/distribution";
import { expandHomePath } from "pstdio-paths";
import { apiClient } from "../api-client";
import { uploadExtensionSource } from "./upload-source";

export const hostProjectSourcePath = (projectRoot: string, source: string) => {
  let hostRoot: string;
  try {
    hostRoot = realpathSync(projectRoot);
  } catch {
    return null;
  }
  const path = relative(hostRoot, realpathSync(source));
  if (path === ".." || path.startsWith("../") || path.startsWith("..\\") || isAbsolute(path)) return null;
  return path.replaceAll("\\", "/") || ".";
};

export const localExtensionSourceRequest = async (
  projectId: string,
  sourcePath: string,
  options: {
    installName?: string;
    force?: boolean;
    skipInstall?: boolean;
    development?: boolean;
  },
) => {
  const source = resolve(expandHomePath(sourcePath, homedir()));
  if (source.endsWith(".tgz")) {
    const temporary = await mkdtemp(join(tmpdir(), "pstdio-extension-package-"));
    try {
      const manifest = await unpackExtension(await Bun.file(source).bytes(), temporary);
      return {
        upload: uploadExtensionSource(temporary, { ...options, installName: options.installName ?? manifest.id }),
      };
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }
  const origin = process.env.PSTDIO_API_URL;
  const localHost = !origin || ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname);
  if (localHost) {
    const workspace = (await apiClient().workspaces.list(projectId)).find((workspace) => workspace.is_default);
    const path =
      workspace?.execution_kind === "local" && workspace.root_path
        ? hostProjectSourcePath(workspace.root_path, source)
        : null;
    if (path !== null) {
      return {
        source: {
          kind: "project-folder",
          path,
          development: options.development,
        },
        installName: options.installName,
        force: options.force,
        skipInstall: options.skipInstall,
      } satisfies InstallExtensionRequest;
    }
  }
  return { upload: uploadExtensionSource(source, options) };
};
