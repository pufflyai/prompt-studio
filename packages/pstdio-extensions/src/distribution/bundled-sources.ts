import type { PackageIdentity } from "./package";
import type { ExtensionReleaseBundle } from "./release-bundle";

export interface BundledExtensionSources {
  commit: string;
  ref: string;
  sources: Array<
    PackageIdentity & {
      installName: string;
      url: string;
      path: string;
      bundles?: ExtensionReleaseBundle[];
    }
  >;
}
