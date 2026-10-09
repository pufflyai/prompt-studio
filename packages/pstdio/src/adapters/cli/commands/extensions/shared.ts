import type { InstalledExtensionSource } from "@pstdio/sdk/api";
import { formatExtensionsCheck } from "pstdio-extensions/authoring";

export type ExtensionsAddArgs = {
  branch?: string;
  force?: boolean;
  name?: string;
  "skip-install"?: boolean;
  source: string;
};

export type ExtensionsCheckArgs = {
  json?: boolean;
  scope?: "repo" | "user";
  source?: string;
};

export const formatInstallOutput = (installed: InstalledExtensionSource, projectId: string) => {
  const lines = ["Installed extension:", `  Id: ${installed.metadata.id}`, `  Name: ${installed.metadata.name}`];
  if (installed.metadata.version) lines.push(`  Version: ${installed.metadata.version}`);
  lines.push(
    `  Source: ${installed.targetPath}`,
    `  Project: enabled for ${projectId}`,
    "",
    formatExtensionsCheck(installed.check),
  );
  return lines.join("\n");
};
