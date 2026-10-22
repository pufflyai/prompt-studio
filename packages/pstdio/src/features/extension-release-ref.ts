import { CLI_VERSION } from "./cli-version";

// Stable builds use PSX. A nightly keeps its main commit because its tag is deleted
// once a newer nightly is published.
declare const PSTDIO_BUILD_EXTENSION_RELEASE_REF: string | undefined;

const defaultExtensionReleaseRef = () => {
  if (
    typeof PSTDIO_BUILD_EXTENSION_RELEASE_REF === "string" &&
    !/^pstdio@\d+\.\d+\.\d+$/.test(PSTDIO_BUILD_EXTENSION_RELEASE_REF)
  )
    return PSTDIO_BUILD_EXTENSION_RELEASE_REF;
  if (CLI_VERSION.includes("-")) return `pstdio@${CLI_VERSION}`;
  return "psx:https://base.prompt.studio/psx";
};
export const DEFAULT_EXTENSION_RELEASE_REF = defaultExtensionReleaseRef();
