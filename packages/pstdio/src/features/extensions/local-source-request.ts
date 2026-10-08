import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import type { InstallExtensionRequest } from "@pstdio/sdk/api";
import { expandHomePath } from "pstdio-paths";
import { apiClient } from "../api-client";
import { uploadExtensionSource } from "./upload-source";

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
  const installName = options.installName ?? basename(source);
  const origin = process.env.PSTDIO_API_URL;
  const localHost = !origin || ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname);
  if (localHost) {
    const workspace = (await apiClient().workspaces.list(projectId)).find((workspace) => workspace.is_default);
    const target = workspace?.root_path && join(workspace.root_path, ".pstdio/extensions", installName);
    if (
      workspace?.execution_kind === "local" &&
      target &&
      existsSync(target) &&
      realpathSync(target) === realpathSync(source)
    ) {
      return {
        source: {
          kind: "project-folder",
          path: `.pstdio/extensions/${installName}`,
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
