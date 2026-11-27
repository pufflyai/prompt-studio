import { createRelayAccess, fetchSyncSpaces } from "pstdio-sync/relay";
import { managedExtensionHostVersion } from "pstdio-sync-contracts";

// Only the host enforcing required-package policy advertises this capability; generic clients opt in explicitly.
export const createNativeRelayAccess = (input: Parameters<typeof createRelayAccess>[0]) =>
  createRelayAccess({ ...input, managedExtensions: managedExtensionHostVersion });
export const fetchNativeSyncSpaces = (input: Parameters<typeof fetchSyncSpaces>[0]) =>
  fetchSyncSpaces({ ...input, managedExtensions: managedExtensionHostVersion });
