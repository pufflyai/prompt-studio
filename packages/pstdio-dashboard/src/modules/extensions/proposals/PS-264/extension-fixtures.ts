import type { ExtensionDiagnostic, ProjectExtensionInstance } from "@pstdio/sdk/api";

export type ExtensionVisibility = "public" | "private";
export type VisibilityFilter = "all" | ExtensionVisibility;
export type ScopeFilter = "all" | ProjectExtensionInstance["scope"];

// Explicit private availability is proposed metadata; the host's unknown value is not private.
export interface ExtensionPreview extends Omit<ProjectExtensionInstance, "visibility"> {
  visibility: ExtensionVisibility;
  diagnostics: ExtensionDiagnostic[];
}

const fixture = (
  name: string,
  displayName: string,
  description: string,
  icon: string,
  visibility: ExtensionVisibility,
  scope: ProjectExtensionInstance["scope"],
): ExtensionPreview => ({
  id: `${name}-instance`,
  projectId: "canvas-project",
  extensionId: `example.${name}`,
  installedExtensionId: `installed-${name}`,
  installName: name,
  name,
  displayName,
  description,
  icon,
  visibility,
  scope,
  sourcePath: `${scope === "repo" ? "/projects/website" : "/Users/alex"}/.pstdio/extensions/${name}`,
  version: "1.2.0",
  status: "loaded",
  enabled: true,
  config: {},
  canUpgrade: false,
  updateAvailable: false,
  diagnostics: [],
});

export const installedExtensions: ExtensionPreview[] = [
  fixture("planner", "Planner", "Plan tickets and track work in this project.", "Kanban", "public", "repo"),
  {
    ...fixture("notes", "Notes", "Keep notes alongside your work.", "NotebookPen", "public", "global"),
    diagnostics: [
      {
        code: "template-outdated",
        severity: "warning",
        message: "The meeting template has changed. Review the updated template in Notes settings.",
        extensionId: "example.notes",
      },
    ],
  },
  {
    ...fixture(
      "release-tools",
      "Release tools",
      "Prepare releases for the website.",
      "PackageCheck",
      "private",
      "repo",
    ),
    status: "error",
    lastError: {
      code: "extension_import_failed",
      message: "Cannot load the release helper package. Install the missing dependency and reload the extension.",
    },
  },
  fixture(
    "my-snippets",
    "My snippets",
    "Reuse your prompts and snippets across projects.",
    "Braces",
    "private",
    "global",
  ),
  {
    ...fixture("reports", "Reports", "Read and compare agent reports.", "FileChartColumn", "public", "global"),
    enabled: false,
    status: "disabled",
  },
  {
    ...fixture(
      "design-checks",
      "Design checks",
      "Review interface changes before release.",
      "ScanEye",
      "private",
      "repo",
    ),
    enabled: false,
    status: "disabled",
  },
];
