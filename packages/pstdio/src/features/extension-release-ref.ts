import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { CLI_VERSION } from "./cli-version";
import { shouldLoadEmbedManifest } from "./should-load-embed-manifest";

// Release builds bake the source ref of their bundled catalog extensions. A nightly bakes
// its main commit, because its own tag is deleted once a newer nightly is published.
declare const PSTDIO_BUILD_EXTENSION_RELEASE_REF: string | undefined;

export const DEFAULT_EXTENSION_RELEASE_REF =
  typeof PSTDIO_BUILD_EXTENSION_RELEASE_REF === "string" ? PSTDIO_BUILD_EXTENSION_RELEASE_REF : `pstdio@${CLI_VERSION}`;

export const resolveDefaultExtensionSourceRoot = () => {
  if (shouldLoadEmbedManifest()) return;
  const root = resolve(import.meta.dir, "../../../..");
  if (existsSync(join(root, "extensions", "pstdio-home", "package.json"))) return root;
};
