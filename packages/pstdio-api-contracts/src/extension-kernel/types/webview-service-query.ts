import type { PerformanceSnapshot } from "../../performance-diagnostics";
import type { AccountDevice, AccountStatus, ProjectSyncStatus } from "./account";
import type { WebviewCommandQuerySnapshot } from "./webview-command-query";
import type { WebviewPreferencesGetParams, WebviewPreferencesSetParams } from "./webview-preferences";

/** Services retain their own authority and cadence; these are not extension commands. */
export type WebviewAccountQuery =
  | { service: "status" }
  | { service: "projectSyncStatus"; projectId: string }
  | { service: "devices"; accountId: string; managerOrigin: string };
export type WebviewPerformanceQuery = { service: "snapshot" };
export type WebviewPreferenceQuery = { service: "preference" } & WebviewPreferencesGetParams;
export interface WebviewPreferenceQueryValue {
  value?: WebviewPreferencesSetParams["value"];
}
export type WebviewServiceQueryDefinition = WebviewAccountQuery | WebviewPerformanceQuery | WebviewPreferenceQuery;
export type WebviewServiceQueryRequest<Definition = WebviewServiceQueryDefinition> =
  | { operation: "observe" | "read" | "refresh"; owner: string; requestId: string; source: Definition }
  | { operation: "close"; owner: string; requestId: string };
export interface WebviewServiceQuerySeed<Definition = WebviewServiceQueryDefinition> {
  source: Definition;
  snapshot: WebviewCommandQuerySnapshot;
}
export interface WebviewServiceQuerySeeds<Definition = WebviewServiceQueryDefinition> {
  owner: string;
  values: readonly WebviewServiceQuerySeed<Definition>[];
}
export type WebviewAccountQueryValue<Definition extends WebviewAccountQuery> = Definition extends { service: "status" }
  ? AccountStatus
  : Definition extends { service: "devices" }
    ? AccountDevice[]
    : ProjectSyncStatus;
export type WebviewPerformanceQueryValue = PerformanceSnapshot | null;
