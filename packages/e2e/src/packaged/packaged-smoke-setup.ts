import { beforeAll } from "bun:test";
import { buildBinary } from "./packaged-helpers";

// Register the hook in each owning test file so native Bun shards build or verify
// their packaged binary before any feature runs. Keep the existing build allowance.
export const setupPackagedSmokeTests = (prepare?: () => Promise<void>) =>
  beforeAll(async () => {
    buildBinary();
    await prepare?.();
  }, 180_000);
