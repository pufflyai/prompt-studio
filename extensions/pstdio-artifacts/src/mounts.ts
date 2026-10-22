import { defineArtifactMount, l10n } from "@pstdio/sdk/extensions";

export const sites = defineArtifactMount({ id: "sites", path: "sites", label: l10n("mounts.sites", "Published HTML") });

// The SDK does not expose a mount's workspace path. Extension files live under the package name.
export const sitesPath = `.pstdio/extension-storage/pstdio-artifacts/${sites.path}/`;
