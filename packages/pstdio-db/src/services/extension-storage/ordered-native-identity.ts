export const orderedNativeRequestPrefix = "native-text:";
export const isOrderedNativeRequest = (identity: string | null | undefined) =>
  identity?.startsWith(orderedNativeRequestPrefix) ?? false;
