import type { ExtensionDiagnostic, ProjectExtensionInstance } from "@pstdio/sdk/api";

export type ExtensionAuthor = "me" | "prompt-studio";
export type AuthorFilter = "all" | ExtensionAuthor;
export type ScopeFilter = "all" | ProjectExtensionInstance["scope"];

// Authorship is explicit sample metadata, independent of installation scope and editable source ownership.
export interface ExtensionPreview extends ProjectExtensionInstance {
  author: ExtensionAuthor;
  diagnostics: ExtensionDiagnostic[];
}

const fixture = (
  name: string,
  displayName: string,
  description: string,
  icon: string,
  author: ExtensionAuthor,
  scope: ProjectExtensionInstance["scope"],
): ExtensionPreview => ({
  id: `${name}-instance`,
  projectId: "canvas-project",
  extensionId: `${author === "prompt-studio" ? "pstdio" : "example"}.${name}`,
  installedExtensionId: `installed-${name}`,
  installName: name,
  name,
  displayName,
  description,
  icon,
  author,
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
  fixture("planner", "Planner", "Plan tickets and track work in this project.", "Kanban", "prompt-studio", "repo"),
  {
    ...fixture("notes", "Notes", "Keep notes alongside your work.", "NotebookPen", "prompt-studio", "global"),
    diagnostics: [
      {
        code: "template-outdated",
        severity: "warning",
        message: "The meeting template has changed. Review the updated template in Notes settings.",
        extensionId: "pstdio.notes",
      },
    ],
  },
  {
    ...fixture("release-tools", "Release tools", "Prepare releases for the website.", "PackageCheck", "me", "repo"),
    status: "error",
    lastError: {
      code: "extension_import_failed",
      message: "Cannot load the release helper package. Install the missing dependency and reload the extension.",
    },
  },
  fixture("my-snippets", "My snippets", "Reuse your prompts and snippets across projects.", "Braces", "me", "global"),
  {
    ...fixture("reports", "Reports", "Read and compare agent reports.", "FileChartColumn", "prompt-studio", "global"),
    enabled: false,
    status: "disabled",
  },
  {
    ...fixture("design-checks", "Design checks", "Review interface changes before release.", "ScanEye", "me", "repo"),
    enabled: false,
    status: "disabled",
  },
];
