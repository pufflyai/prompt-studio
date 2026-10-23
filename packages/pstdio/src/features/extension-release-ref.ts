import { CLI_VERSION } from "./cli-version";

// Release builds bake the Git ref their core extensions install from. A nightly bakes
// its main commit, because its own tag is deleted once a newer nightly is published.
declare const PSTDIO_BUILD_EXTENSION_RELEASE_REF: string | undefined;

export const DEFAULT_EXTENSION_RELEASE_REF =
  typeof PSTDIO_BUILD_EXTENSION_RELEASE_REF === "string" ? PSTDIO_BUILD_EXTENSION_RELEASE_REF : `pstdio@${CLI_VERSION}`;
