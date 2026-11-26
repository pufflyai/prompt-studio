import { AsyncLocalStorage } from "node:async_hooks";
import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";

// During legacy replay, a saved prefix and the numbers allocated from it must
// keep the same owner until the startup rename moves them together.
export const releasedNumberOwners = new AsyncLocalStorage<ReadonlySet<string>>();
export const numberOwner = (id: string) => (releasedNumberOwners.getStore()?.has(id) ? id : canonicalExtensionId(id));
