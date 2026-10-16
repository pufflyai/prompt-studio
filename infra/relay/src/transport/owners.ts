import type { createEnvironmentAuthorityClient } from "pstdio-account-manager/client";
import type { createRelayAssets } from "../assets/assets";
import type { createRelayStorage } from "../storage/storage";

export interface RelayOwners {
  storage: ReturnType<typeof createRelayStorage>;
  assets: ReturnType<typeof createRelayAssets>;
  authority: ReturnType<typeof createEnvironmentAuthorityClient>;
  subscriptionCheckIntervalMs: number;
}
