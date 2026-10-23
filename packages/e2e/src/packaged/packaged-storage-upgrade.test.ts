import { beforeAll } from "bun:test";
import { buildBinary } from "./packaged-helpers";
import { registerStorageUpgradeSmokeTests } from "./packaged-storage-upgrade-smoke";
import { prepareReleasedStorageHost } from "./released-storage-host";

let releasedBinary: string;
beforeAll(async () => {
  releasedBinary = await prepareReleasedStorageHost();
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
}, 180_000);

registerStorageUpgradeSmokeTests(() => releasedBinary);
