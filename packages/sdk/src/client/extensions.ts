import type { ExtensionsCheckResponse } from "pstdio-api-contracts";
import type { RequestFn } from "./request";

export type ExtensionClient = {
  check(): Promise<ExtensionsCheckResponse>;
};

export const createExtensionClient = (request: RequestFn): ExtensionClient => ({
  check: () => request("/v1/extensions/check"),
});
