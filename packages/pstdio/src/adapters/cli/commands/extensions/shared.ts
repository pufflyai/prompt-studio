import { homedir } from "node:os";
import { resolve } from "node:path";
import type { InstalledExtensionSource } from "@pstdio/sdk/api";
import { formatExtensionsCheck } from "pstdio-extensions/authoring";
import { expandHomePath } from "pstdio-paths";

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

/**
 * Extensions install into the project linked to the current folder. An author
 * folder outside that project needs the project folder and an absolute source path.
 */
export const linkedProjectRequired = (input: { command: "add" | "dev"; cwd: string; source?: string }) => {
  const lines = [`No linked project found from ${input.cwd}. \`pst extensions ${input.command}\` needs one.`];
  if (input.source) {
    const source = resolve(input.cwd, expandHomePath(input.source, homedir()));
    lines.push(
      "Run it from your project folder with the absolute source path:",
      `  pst extensions ${input.command} ${source}`,
    );
  } else {
    lines.push("Run it from your project folder.");
  }
  lines.push("To make the current folder a project instead, run `pst projects create <name>` here.");
  return new Error(lines.join("\n"));
};
