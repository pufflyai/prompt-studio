import type { RouteDeps } from "../../features/deps";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";

export type RelayDeps = ExtensionsRouteDeps & Pick<RouteDeps, "nativeDocuments">;
