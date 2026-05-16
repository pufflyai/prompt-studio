import {
  formatExtensionsCheck,
  type InstalledExtensionSource,
  toExtensionEnableInput,
} from "pstdio-api/extensions/install-extension-source";
import { apiClient } from "@/features/api-client";

export type ExtensionsAddArgs = {
  force?: boolean;
  name?: string;
  "skip-install"?: boolean;
  source: string;
};

export type ExtensionsCheckArgs = {
  json?: boolean;
};

export const enableInstalledExtension = async (projectId: string, installed: InstalledExtensionSource) =>
  apiClient().extensions.enableInstalled(projectId, installed.installName, toExtensionEnableInput(installed));

export const formatInstallOutput = (
  installed: InstalledExtensionSource,
  project:
    | { state: "enabled"; projectId: string }
    | {
        state: "skipped";
      },
) => {
  const lines = ["Installed extension:", `  Id: ${installed.metadata.id}`, `  Name: ${installed.metadata.name}`];

  if (installed.metadata.version) lines.push(`  Version: ${installed.metadata.version}`);
  lines.push(`  Source: ${installed.targetPath}`);

  if (project.state === "enabled") {
    lines.push(`  Project: enabled for ${project.projectId}`);
  } else {
    lines.push("  Project: not enabled");
    lines.push("  Run inside a linked project to enable automatically.");
  }

  lines.push("", formatExtensionsCheck(installed.check));
  return lines.join("\n");
};
