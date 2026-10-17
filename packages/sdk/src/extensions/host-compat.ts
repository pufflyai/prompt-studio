import {
  ALWAYS_AVAILABLE_WEBVIEW_CAPABILITIES as hostAlwaysAvailableWebviewCapabilities,
  normalizePageParams as hostNormalizePageParams,
  qualifyNavigationTarget as hostQualifyNavigationTarget,
  resolveDataTableComparableValue as hostResolveDataTableComparableValue,
  resolveDataTableFieldKind as hostResolveDataTableFieldKind,
  resolvePageParams as hostResolvePageParams,
  validatePageParamDefinitions as hostValidatePageParamDefinitions,
  WEBVIEW_DECLARABLE_CAPABILITIES as hostWebviewDeclarableCapabilities,
  WEBVIEW_HOST_CAPABILITIES as hostWebviewHostCapabilities,
  WEBVIEW_HOST_CAPABILITY_VERSION as hostWebviewHostCapabilityVersion,
  WEBVIEW_SCOPED_DECLARABLE_CAPABILITIES as hostWebviewScopedDeclarableCapabilities,
} from "pstdio-api-contracts/extension-kernel";
import { mergeOrderedHistory as hostMergeOrderedHistory } from "pstdio-api-contracts/history-reconciliation";

/** @deprecated Host-only. Hosts import `ALWAYS_AVAILABLE_WEBVIEW_CAPABILITIES` from `pstdio-api-contracts`. */
export const ALWAYS_AVAILABLE_WEBVIEW_CAPABILITIES = hostAlwaysAvailableWebviewCapabilities;

/** @deprecated Host-only. Hosts import `WEBVIEW_DECLARABLE_CAPABILITIES` from `pstdio-api-contracts`. */
export const WEBVIEW_DECLARABLE_CAPABILITIES = hostWebviewDeclarableCapabilities;

/** @deprecated Host-only. Hosts import `WEBVIEW_HOST_CAPABILITIES` from `pstdio-api-contracts`. */
export const WEBVIEW_HOST_CAPABILITIES = hostWebviewHostCapabilities;

/** @deprecated Host-only. Hosts import `WEBVIEW_HOST_CAPABILITY_VERSION` from `pstdio-api-contracts`. */
export const WEBVIEW_HOST_CAPABILITY_VERSION = hostWebviewHostCapabilityVersion;

/** @deprecated Host-only. Hosts import `WEBVIEW_SCOPED_DECLARABLE_CAPABILITIES` from `pstdio-api-contracts`. */
export const WEBVIEW_SCOPED_DECLARABLE_CAPABILITIES = hostWebviewScopedDeclarableCapabilities;

/** @deprecated Host-only. Hosts import `normalizePageParams` from `pstdio-api-contracts`. */
export const normalizePageParams = hostNormalizePageParams;

/** @deprecated Host-only. Hosts import `qualifyNavigationTarget` from `pstdio-api-contracts`. */
export const qualifyNavigationTarget = hostQualifyNavigationTarget;

/** @deprecated Host-only. Hosts import `resolveDataTableComparableValue` from `pstdio-api-contracts`. */
export const resolveDataTableComparableValue = hostResolveDataTableComparableValue;

/** @deprecated Host-only. Hosts import `resolveDataTableFieldKind` from `pstdio-api-contracts`. */
export const resolveDataTableFieldKind = hostResolveDataTableFieldKind;

/** @deprecated Host-only. Hosts import `resolvePageParams` from `pstdio-api-contracts`. */
export const resolvePageParams = hostResolvePageParams;

/** @deprecated Host-only. Hosts import `validatePageParamDefinitions` from `pstdio-api-contracts`. */
export const validatePageParamDefinitions = hostValidatePageParamDefinitions;

/** @deprecated Host-only. Hosts import `mergeOrderedHistory` from `pstdio-api-contracts`. */
export const mergeOrderedHistory = hostMergeOrderedHistory;
