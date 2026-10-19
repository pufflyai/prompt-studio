import { defineArtifactMount, l10n } from "@pstdio/sdk/extensions";

export const documents = defineArtifactMount({
  id: "documents",
  path: "documents",
  label: l10n("mounts.documents", "Notes"),
});

// The SDK does not expose a mount's workspace path. Extension files live under the package name.
export const documentsPath = `.pstdio/extension-storage/pstdio-notes/${documents.path}/`;
