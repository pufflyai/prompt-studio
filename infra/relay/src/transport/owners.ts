import type { createEnvironmentAccessVerifier } from "pstdio-account-manager/access";
import type { createRelayAssets } from "../assets/assets";
import type { createRecoveryProofs } from "../recovery-proofs";
import type { createRelayStorage } from "../storage/storage";

export interface RelayOwners {
  storage: ReturnType<typeof createRelayStorage>;
  assets: ReturnType<typeof createRelayAssets>;
  verifyAccess: ReturnType<typeof createEnvironmentAccessVerifier>;
  recovery: ReturnType<typeof createRecoveryProofs>;
}
