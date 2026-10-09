import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, relative, resolve } from "node:path";
import type { InstallExtensionRequest } from "@pstdio/sdk/api";
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
