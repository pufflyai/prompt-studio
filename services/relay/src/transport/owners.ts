import type { createEnvironmentAccessVerifier } from "pstdio-account-manager/access";
import type { createRelayAssets } from "../assets/assets";
import type { ObjectConfig } from "../assets/objects";
import type { RelayLimits } from "../limits";
import type { createRecoveryProofs } from "../recovery-proofs";
import type { createRelayStorage } from "../storage/storage";
import { createRelaySync, type RelaySync } from "../storage/sync";
import { createLiveHub, type LiveHub } from "./live";
import { createRateLimit, type RateLimit } from "./rate-limit";

export interface RelayOwners {
  storage: ReturnType<typeof createRelayStorage>;
  assets: ReturnType<typeof createRelayAssets>;
  verifyAccess: ReturnType<typeof createEnvironmentAccessVerifier>;
  recovery: ReturnType<typeof createRecoveryProofs>;
  sync: RelaySync;
  live: LiveHub;
  limits: RelayLimits;
  allow: RateLimit;
}

/** The document store, live hub and limits behind the sync protocol. */
export const createSyncOwners = (
  config: ObjectConfig & { databaseUrl: string; assets: ReturnType<typeof createRelayAssets>; limits: RelayLimits },
) => {
  const allow = createRateLimit(config.limits.requestsPerSecond, config.limits.requestBurst);
  const sync = createRelaySync(config);
  const live = createLiveHub(config.limits, allow);
  sync.watch(live.changed);
  return { sync, live, limits: config.limits, allow };
};
