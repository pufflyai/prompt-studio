import type { PackageIdentity } from "./package";

export interface BundledExtensionSources {
  commit: string;
  ref: string;
  sources: Array<
    PackageIdentity & {
      installName: string;
      url: string;
      path: string;
    }
  >;
}
