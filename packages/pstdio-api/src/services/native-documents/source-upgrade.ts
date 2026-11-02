import type { createExtensionStorageDBService } from "pstdio-db";
import { apiLogger } from "../../lib/logger";

export const upgradeNativeSources = (storage: ReturnType<typeof createExtensionStorageDBService>) =>
  storage.upgradeNativeSources({
    failed: (_error, row) =>
      apiLogger.error(
        { event: "native-source.upgrade.failed", ...row },
        "Kept original source data. Shared editing stays pending for affected records; repair the source history before restarting.",
      ),
  });
