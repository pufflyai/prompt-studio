import type { HarnessParams } from "@pstdio/sdk/extensions";

export const toOpencodeModel = (model?: string | null, params?: HarnessParams) => {
  if (!model) return undefined;
  const slash = model.indexOf("/");
  if (slash <= 0 || slash === model.length - 1) return undefined;
  return {
    providerID: model.slice(0, slash),
    id: model.slice(slash + 1),
    ...(typeof params?.variant === "string" ? { variant: params.variant } : {}),
  };
};
