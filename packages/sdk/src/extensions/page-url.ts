import {
  type PageUrlDefinition as HostPageUrlDefinition,
  type ParsedWorkbenchPageUrl as HostParsedWorkbenchPageUrl,
  isWorkbenchProjectUrl as hostIsWorkbenchProjectUrl,
  parsePageUrl as hostParsePageUrl,
  parseWorkbenchPageUrl as hostParseWorkbenchPageUrl,
  serializePageUrl as hostSerializePageUrl,
  serializeWorkbenchPageUrl as hostSerializeWorkbenchPageUrl,
} from "pstdio-api-contracts/extension-kernel";

/** @deprecated Host-only. Hosts import `serializeWorkbenchPageUrl` from `pstdio-api-contracts`. */
export const serializeWorkbenchPageUrl = hostSerializeWorkbenchPageUrl;

/** @deprecated Host-only. Hosts import `isWorkbenchProjectUrl` from `pstdio-api-contracts`. */
export const isWorkbenchProjectUrl = hostIsWorkbenchProjectUrl;

/** @deprecated Host-only. Hosts import `parseWorkbenchPageUrl` from `pstdio-api-contracts`. */
export const parseWorkbenchPageUrl = hostParseWorkbenchPageUrl;

/** @deprecated Host-only. Hosts import `serializePageUrl` from `pstdio-api-contracts`. */
export const serializePageUrl = hostSerializePageUrl;

/** @deprecated Host-only. Hosts import `parsePageUrl` from `pstdio-api-contracts`. */
export const parsePageUrl = hostParsePageUrl;

/** @deprecated Host-only. Hosts import `PageUrlDefinition` from `pstdio-api-contracts`. */
export type PageUrlDefinition = HostPageUrlDefinition;

/** @deprecated Host-only. Hosts import `ParsedWorkbenchPageUrl` from `pstdio-api-contracts`. */
export type ParsedWorkbenchPageUrl = HostParsedWorkbenchPageUrl;
