export const orderedNativeRequestPrefix = "native-text:";
export const isOrderedNativeRequest = (identity: string | null | undefined) =>
  identity?.startsWith(orderedNativeRequestPrefix) ?? false;
export const orderedNativeRequestIdentity = (identity: string) =>
  isOrderedNativeRequest(identity) ? identity.slice(orderedNativeRequestPrefix.length) : identity;
