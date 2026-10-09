import type { ExtensionsCheckResponse } from "pstdio-api-contracts";

export const formatExtensionsCheck = (check: ExtensionsCheckResponse) => {
  const lines = [
    `Extensions root: ${check.extensionsRoot}`,
    `Extensions found: ${check.extensions.length}`,
    `Commands: ${check.commands.length}`,
    `Warnings: ${check.warningCount}`,
    `Errors: ${check.errorCount}`,
    `Host compatibility: ${check.hostCompatibility.status}${
      check.hostCompatibility.host
        ? ` (${check.hostCompatibility.host.host} ${check.hostCompatibility.host.hostVersion})`
        : ""
    }`,
  ];

  for (const extension of check.extensions) {
    lines.push("", `${extension.displayName} (${extension.id})`, `  Name: ${extension.name}`);
    if (extension.version) lines.push(`  Version: ${extension.version}`);
    lines.push(`  Source: ${extension.sourcePath}`);
  }

  for (const diagnostic of check.diagnostics) {
    lines.push("", `${diagnostic.severity.toUpperCase()}: ${diagnostic.message}`);
    const missingCapability = diagnostic.metadata?.missingCapability;
    const contributionId = diagnostic.metadata?.contributionId;
    const requiredSince = diagnostic.metadata?.requiredSince;
    if (typeof contributionId === "string") lines.push(`  Contribution: ${contributionId}`);
    if (typeof missingCapability === "string") lines.push(`  Missing capability: ${missingCapability}`);
    if (typeof requiredSince === "string") lines.push(`  Supported since: ${requiredSince}`);
    if (diagnostic.sourcePath) lines.push(`  Source: ${diagnostic.sourcePath}`);
  }

  return lines.join("\n");
};
